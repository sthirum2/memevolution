from abc import ABC, abstractmethod


class TikTokService(ABC):
    """Boundary for deployment and metrics; the MVP implementation is manual."""

    @abstractmethod
    def deploy(self, post_id: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_metrics(self, post_id: str) -> dict:
        raise NotImplementedError


class ManualTikTokService(TikTokService):
    def deploy(self, post_id: str) -> str:
        return post_id

    def get_metrics(self, post_id: str) -> dict:
        raise NotImplementedError("Metrics are entered manually for the MVP")