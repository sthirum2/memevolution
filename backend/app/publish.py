"""
Publishing to a real account, server-side.

Lives here rather than in the browser because it holds the access tokens. A
long-lived Instagram token in frontend code would be shipped to every visitor.

Instagram image publishing and real engagement retrieval.
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

load_dotenv()

GRAPH = "https://graph.facebook.com/" + os.environ.get("IG_GRAPH_VERSION", "v21.0")


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
    if platform != "instagram":
        raise PublishError("Only Instagram is supported")
    content = experiment.get("content") or {}
    media_url = content.get("media_url", "")
    if not media_url.startswith("/media/"):
        raise PublishError("Prepare and review the generated image first")
    filename = media_url.removeprefix("/media/")
    if not filename or "/" in filename or "\\" in filename:
        raise PublishError("Invalid prepared media path")
    return _publish_instagram(experiment["id"], filename, content.get("caption", ""), "gemini")


def validate_configuration():
    missing = [key for key in ("IG_ACCESS_TOKEN", "IG_USER_ID", "PUBLIC_MEDIA_BASE") if not os.environ.get(key)]
    if missing:
        raise PublishError("Instagram configuration missing: " + ", ".join(missing))
    base = urllib.parse.urlparse(os.environ["PUBLIC_MEDIA_BASE"])
    if base.scheme != "https" or not base.hostname or base.hostname in {"localhost", "127.0.0.1"}:
        raise PublishError("PUBLIC_MEDIA_BASE must be the public HTTPS origin serving /media")


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

    media_url = f"{base}/media/{filename}"
    # A reel and a photo are different container types on the Graph API: video
    # goes up as media_type=REELS with video_url, and image_url rejects an mp4
    # outright. The pipeline produces video now, so the container follows the
    # file rather than being fixed to one kind.
    is_video = filename.lower().endswith((".mp4", ".mov"))
    payload = (
        {"media_type": "REELS", "video_url": media_url}
        if is_video
        else {"image_url": media_url}
    )
    noun = "reel" if is_video else "image"
    try:
        container = _post(
            f"{GRAPH}/{ig_id}/media",
            {**payload, "caption": caption, "access_token": token},
        )
        cid = container["id"]
        # Video transcoding is far slower than an image fetch, so it gets a
        # longer budget; a premature give-up here risks a duplicate post.
        attempts = 60 if is_video else 10
        for _ in range(attempts):
            st = _get(f"{GRAPH}/{cid}?fields=status_code&access_token={token}")
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                raise PublishError(f"Instagram could not process the {noun}.")
            time.sleep(2)
        else:
            raise PublishError(f"Instagram {noun} processing timed out; no publish request was sent")
        published = _post(
            f"{GRAPH}/{ig_id}/media_publish", {"creation_id": cid, "access_token": token}
        )
        media_id = published["id"]
        # Publishing has succeeded. A permalink failure must not lose the media ID.
        try:
            link = _get(f"{GRAPH}/{media_id}?fields=permalink&access_token={token}")
        except Exception:
            link = {}
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


def live_metrics(experiment: dict) -> dict:
    """Ask the platform what actually happened to the post."""
    from .fitness import spread_score

    post_id = (experiment.get("deployment") or {}).get("post_id")
    platform = (experiment.get("deployment") or {}).get("platform")
    if not post_id or post_id.startswith("pending_"):
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
            ins = _get(f"{GRAPH}/{post_id}/insights?metric=views,saved,shares&access_token={token}")
            for row in ins.get("data", []):
                values = row.get("values") or []
                value = values[0].get("value") if values else row.get("total_value", {}).get("value")
                key = {"views": "views", "saved": "saves", "shares": "shares"}.get(row["name"])
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
        "fitness": spread_score(**metrics) if all(v is not None for v in metrics.values()) else None,
    }
