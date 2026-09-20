"""Two-process persistence check using an existing observed experiment."""
import argparse
import json

from memevolution.integration.backboard_memory import configured_memory
from memevolution.persistence.json_store import load_experiments


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    store = sub.add_parser("store")
    store.add_argument("experiment_id")
    search = sub.add_parser("search")
    search.add_argument("query")
    search.add_argument("--expect-experiment", required=True)
    args = parser.parse_args()
    client = configured_memory()
    if client is None:
        parser.error("Set BACKBOARD_API_KEY and BACKBOARD_ASSISTANT_ID in both processes")
    if args.command == "store":
        experiment = next((e for e in load_experiments() if e.id == args.experiment_id), None)
        if experiment is None:
            parser.error("No persisted experiment with that ID")
        print(json.dumps(client.store_experiment_memory(experiment), indent=2))
    else:
        memories = client.retrieve_relevant_memories(args.query)
        print(json.dumps({"query": args.query, "memories": memories}, indent=2))
        marker = '"experiment_id": ' + json.dumps(args.expect_experiment)
        if not any(marker in m["content"] for m in memories):
            raise SystemExit("FAIL: expected experiment was not retrieved; indexing may still be pending")
        print("PASS: a fresh process retrieved the expected historical experiment from Backboard")


if __name__ == "__main__":
    main()
