"""HTTP regression tests; fixtures are synthetic and stored only in a temporary DB."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        env = dict(os.environ, DATABASE_URL="sqlite:///" +
                   (Path(cls.temp.name) / "test.db").as_posix())
        cls.log = tempfile.TemporaryFile(mode="w+")
        runner = (
            "import sys, threading, uvicorn; "
            f"server = uvicorn.Server(uvicorn.Config('app.main:app', host='127.0.0.1', port={port})); "
            "threading.Thread(target=lambda: (sys.stdin.readline(), setattr(server, 'should_exit', True)), "
            "daemon=True).start(); server.run()"
        )
        cls.server = subprocess.Popen(
            [sys.executable, "-c", runner], stdin=subprocess.PIPE,
            cwd=Path(__file__).resolve().parents[1], env=env, stdout=cls.log, stderr=cls.log)
        cls.addClassCleanup(cls.cleanup)
        for _ in range(100):
            try:
                cls.request("GET", "/health")
                return
            except (URLError, ConnectionError):
                if cls.server.poll() is not None:
                    break
                time.sleep(0.1)
        cls.log.seek(0)
        raise RuntimeError(cls.log.read())

    @classmethod
    def cleanup(cls):
        cls.server.communicate(input=b"\n", timeout=10)
        cls.log.close()
        cls.temp.cleanup()

    @classmethod
    def request(cls, method, path, body=None):
        request = Request(cls.base + path, method=method,
                          data=json.dumps(body).encode() if body is not None else None,
                          headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_existing_flow_and_time_series(self):
        self.assertEqual(self.request("GET", "/health"), (200, {"status": "ok"}))
        payload = {"id": "test_exp", "generation": 0, "hypothesis": "Test fixture",
                   "genome": {"topic": "test", "humor": "test", "format": "test", "hook": "test",
                              "absurdity": .5, "irony": .5, "relatability": .5,
                              "trend_relevance": .5, "video_length": 15}}
        self.assertEqual(self.request("POST", "/experiments", payload)[0], 201)
        self.assertEqual(self.request("POST", "/experiments", payload)[0], 409)
        base = "/experiments/test_exp"
        self.assertEqual(self.request("GET", base + "/snapshots"), (200, []))
        self.assertEqual(self.request("GET", base + "/propagation"), (200, []))
        self.assertEqual(self.request("POST", base + "/metrics", {"views": 1})[0], 409)
        prediction = self.request("POST", base + "/prediction", {"predicted_fitness": .7, "model_version": "test"})
        self.assertEqual(prediction[1]["prediction"]["fitness"], .7)
        self.assertEqual(self.request("POST", base + "/deploy", {"post_id": "test-only"})[0], 200)
        for timestamp, views, shares in [
            ("2026-01-01T02:30:00Z", 370, 13),
            ("2026-01-01T03:00:00+01:00", 50, 1),
            ("2026-01-01T02:15:00", 140, 4),
        ]:
            code, body = self.request("POST", base + "/metrics", {
                "timestamp": timestamp, "views": views, "shares": shares,
                "likes": 4, "comments": 1, "saves": 2, "fitness": .4})
            self.assertEqual(code, 200)
            self.assertEqual(body["observed"]["views"], 370)
        history = self.request("GET", base + "/snapshots")[1]
        self.assertEqual([item["views"] for item in history], [50, 140, 370])
        self.assertEqual(len({item["id"] for item in history}), 3)
        points = self.request("GET", base + "/propagation")[1]
        self.assertIsNone(points[0]["views_per_hour"])
        self.assertEqual(points[1]["view_growth"], 90)
        self.assertEqual(points[1]["views_per_hour"], 360)
        self.assertEqual(points[1]["shares_per_hour"], 12)
        self.assertEqual(points[2]["elapsed_seconds"], 1800)
        self.request("POST", base + "/metrics", {"timestamp": "2026-01-01T02:30:00Z", "views": 360})
        point = self.request("GET", base + "/propagation")[1][-1]
        self.assertEqual(point["view_growth"], -10)
        self.assertIsNone(point["views_per_hour"])
        self.assertIsNone(point["share_growth"])
        self.request("POST", base + "/metrics", {})
        self.assertEqual(len(self.request("GET", base + "/snapshots")[1]), 5)
        self.assertEqual(self.request("POST", base + "/metrics", {"views": -1})[0], 422)
        self.assertEqual(len(self.request("GET", "/experiments?generation=0")[1]), 1)
        self.assertEqual(self.request("GET", "/generations")[1][0]["generation"], 0)
        self.assertEqual(self.request("GET", base)[0], 200)
        for suffix in ("", "/snapshots", "/propagation"):
            self.assertEqual(self.request("GET", "/experiments/missing" + suffix)[0], 404)


if __name__ == "__main__":
    unittest.main()
