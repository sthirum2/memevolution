"""
Publishing to a real account, server-side.

Lives here rather than in the browser because it holds the access tokens. A
long-lived Instagram token in frontend code would be shipped to every visitor.

Instagram publishes outright. TikTok deliberately uses the inbox upload route:
Direct Post forces SELF_ONLY visibility on any unaudited app, so the post would
be invisible and there would be no spread to measure. The inbox route has no
visibility restriction because the creator publishes it themselves.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from .env import load_dotenv
from .generate_image import make_meme_image

load_dotenv()

GRAPH = "https://graph.facebook.com/v21.0"


class PublishError(Exception):
    """Something the operator needs to fix, phrased so they can fix it."""


def _get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())


def _post(url: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=60) as r:
        return json.loads(r.read().decode())


def _graph_error(e: urllib.error.HTTPError) -> str:
    try:
        err = json.loads(e.read().decode()).get("error", {})
    except Exception:
        return f"HTTP {e.code}"
    hints = {
        190: "Token invalid or expired — generate a new long-lived one.",
        200: "Token needs instagram_content_publish, and the account must hold a role on the app.",
        100: "Usually a wrong IG_USER_ID, or a media_url Meta could not fetch.",
        9007: "Meta could not download the image. media_url must be publicly reachable.",
        4: "Rate limited — Instagram allows 50 published posts per 24h.",
    }
    code = err.get("code")
    return f"{err.get('message', '')} (code {code}). {hints.get(code, '')}".strip()


def publish(experiment: dict, platform: str) -> dict:
    """Render the meme and put it on the platform. Raises PublishError with guidance."""
    content = experiment.get("content") or {}
    genome = experiment.get("genome") or {}

    path, source = make_meme_image(
        experiment["id"],
        content.get("headline", ""),
        content.get("punchline", ""),
        content.get("visual_description", ""),
        genome.get("topic", ""),
    )

    if platform == "instagram":
        return _publish_instagram(experiment["id"], path.name, content.get("caption", ""), source)
    if platform == "tiktok":
        return _upload_tiktok(experiment["id"], path, source)
    raise PublishError(f"No publisher wired for {platform!r}. Use instagram or tiktok.")


def _publish_instagram(experiment_id: str, filename: str, caption: str, source: str) -> dict:
    token = os.environ.get("IG_ACCESS_TOKEN")
    ig_id = os.environ.get("IG_USER_ID")
    base = (os.environ.get("PUBLIC_MEDIA_BASE") or "").rstrip("/")

    missing = [
        n
        for n, v in (("IG_ACCESS_TOKEN", token), ("IG_USER_ID", ig_id), ("PUBLIC_MEDIA_BASE", base))
        if not v
    ]
    if missing:
        raise PublishError(
            f"Instagram is not configured. Missing from backend/.env: {', '.join(missing)}. "
            "Setup steps are in frontend/README.md. PUBLIC_MEDIA_BASE needs a public url — "
            "run ./scripts/tunnel.sh — because Meta fetches the image from its own servers."
        )

    media_url = f"{base}/{filename}"
    try:
        container = _post(
            f"{GRAPH}/{ig_id}/media",
            {"image_url": media_url, "caption": caption, "access_token": token},
        )
        cid = container["id"]
        for _ in range(10):
            st = _get(f"{GRAPH}/{cid}?fields=status_code&access_token={token}")
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                raise PublishError("Instagram could not process the image.")
            time.sleep(2)
        published = _post(
            f"{GRAPH}/{ig_id}/media_publish", {"creation_id": cid, "access_token": token}
        )
        media_id = published["id"]
        link = _get(f"{GRAPH}/{media_id}?fields=permalink&access_token={token}")
    except urllib.error.HTTPError as e:
        raise PublishError(_graph_error(e)) from None

    return {
        "experiment_id": experiment_id,
        "platform": "instagram",
        "post_id": media_id,
        "permalink": link.get("permalink"),
        "published_at": datetime.now(timezone.utc).isoformat(),
        "status": "live",
        "instructions": None,
        "image_source": source,
    }


def _upload_tiktok(experiment_id: str, path, source: str) -> dict:
    token = os.environ.get("TIKTOK_ACCESS_TOKEN")
    if not token:
        raise PublishError(
            "TikTok is not configured. Put TIKTOK_ACCESS_TOKEN in backend/.env. "
            "Use the video.upload scope (inbox upload), not video.publish — Direct Post "
            "forces SELF_ONLY on unaudited apps, so nobody would see it."
        )

    from .render import image_to_video

    try:
        video_path = image_to_video(path)
    except Exception as exc:
        raise PublishError(
            f"Could not turn the rendered meme into a video for TikTok: {exc}"
        ) from None

    size = video_path.stat().st_size
    try:
        init = _post(
            "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
            {
                "source_info": json.dumps(
                    {
                        "source": "FILE_UPLOAD",
                        "video_size": size,
                        "chunk_size": size,
                        "total_chunk_count": 1,
                    }
                ),
                "access_token": token,
            },
        )
        publish_id = init.get("data", {}).get("publish_id", "")
        upload_url = init.get("data", {}).get("upload_url")
        if upload_url:
            body = video_path.read_bytes()
            req = urllib.request.Request(upload_url, data=body, method="PUT")
            req.add_header("Content-Range", f"bytes 0-{size - 1}/{size}")
            req.add_header("Content-Type", "video/mp4")
            urllib.request.urlopen(req, timeout=120)
    except urllib.error.HTTPError as e:
        raise PublishError(f"TikTok upload failed: HTTP {e.code} {e.read().decode()[:200]}") from None

    return {
        "experiment_id": experiment_id,
        "platform": "tiktok",
        "post_id": publish_id,
        "permalink": None,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "status": "awaiting_user",
        "instructions": (
            "Open TikTok, go to your profile and look under Drafts. The upload is waiting "
            "there — tap Post. It goes out public."
        ),
        "image_source": source,
    }


def live_metrics(experiment: dict) -> dict:
    """Ask the platform what actually happened to the post."""
    from .fitness import spread_score

    post_id = (experiment.get("deployment") or {}).get("post_id")
    platform = (experiment.get("deployment") or {}).get("platform")
    if not post_id:
        raise PublishError("That experiment has not been published yet.")

    metrics: dict = {"views": None, "likes": None, "comments": None, "shares": None, "saves": None}

    if platform == "instagram":
        token = os.environ.get("IG_ACCESS_TOKEN")
        if not token:
            raise PublishError("IG_ACCESS_TOKEN is missing from backend/.env.")
        try:
            base = _get(f"{GRAPH}/{post_id}?fields=like_count,comments_count&access_token={token}")
            metrics["likes"] = base.get("like_count")
            metrics["comments"] = base.get("comments_count")
            ins = _get(f"{GRAPH}/{post_id}/insights?metric=reach,saved,shares&access_token={token}")
            for row in ins.get("data", []):
                value = row["values"][0]["value"]
                key = {"reach": "views", "saved": "saves", "shares": "shares"}.get(row["name"])
                if key:
                    metrics[key] = value
        except urllib.error.HTTPError as e:
            raise PublishError(_graph_error(e)) from None
    else:
        raise PublishError(
            f"Reading metrics back from {platform} is not wired up. Enter them by hand with "
            "scripts/observe.py."
        )

    return {
        "experiment_id": experiment["id"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        **metrics,
        "fitness": spread_score(**metrics),
    }
