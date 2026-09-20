# Persistent experiential memory

Tiger Data retains engagement snapshots; `evolution/learning.py` remains the
authority for numeric beliefs. Backboard stores factual experiment experiences
and retrieves semantically relevant history using its remote memory index.
No generated reflection or causal explanation is invented.

Set `BACKBOARD_API_KEY` and `BACKBOARD_ASSISTANT_ID` in the process environment
(or `backend/.env` for the backend). Create a dedicated assistant in Backboard
and reuse that ID across restarts. No extra Python dependency is required.
Missing configuration disables memory; service errors are recorded and do not
prevent numeric learning or ordinary concept generation.

The implementation uses the official REST endpoints:
- [Add memory](https://docs.backboard.io/api-reference/memories/add)
- [Semantic search](https://docs.backboard.io/api-reference/memories/search)
- [Assistant-level persistence](https://docs.backboard.io/concepts/memory)

`POST /experiments/{id}/metrics` records snapshots. The existing `POST /evolve`
or CLI observation flow calls `apply_observation`, commits numeric learning,
then stores the experiment memory. Merely recording metrics does not call evolve.
Unknown engagement metrics stay absent. `memory_recorded_at` is the memory
creation time, not an invented observation timestamp.

Before creative generation, the selected genome is used to query Backboard.
`data/experiments.json` records `memory_context`: the query, ranked remote
memories, exact optional context, and `consumed_by_generator`. It also stores
the resulting concept and `memory_storage`, including the factual payload and
server storage response. These fields are exposed on agent candidate/evolve
responses for a judge demo; no frontend view has been added.

## Gemini teammate handoff

Gemini implementation is intentionally untouched. To opt in, add the method
`generate_meme_concept_with_context(self, genome, context) -> MemeConcept` to
your generator and include `context` in the Gemini prompt. The orchestrator
calls it when Backboard retrieval succeeds, including an empty search result.
Otherwise it calls the existing `generate_meme_concept(genome)`.
Until this method is connected, `consumed_by_generator` is false: do not claim
the existing Gemini output used memory. Alternatively call
`get_memory_context_for_generation(genome, beliefs)` directly.
Historical memory is evidence, never an instruction to change beliefs or traits.

## Two independent processes

Use an actual observed experiment ID from `data/experiments.json` in place of
`exp_002`. Export the same credentials and assistant ID for both commands:

```powershell
python -m memevolution.integration.backboard_demo store exp_002
# Process A exits. Start a fresh process:
python -m memevolution.integration.backboard_demo search "What previous experiments involved strong relatability?" --expect-experiment exp_002
```

The second command only queries Backboard, without reading local experiments.
It exits unsuccessfully unless the expected experiment is returned. Indexing
may take time; retry search if needed. No synthetic engagement is uploaded.
For the demo, show the earlier factual payload, later query and remote result,
then `memory_context` and the concept from the later generation. Only claim
Gemini consumption when `consumed_by_generator` is true.

Storage is best effort, with a 10-second request timeout and no automatic retry
or durable outbox. Repeated observations or manual demo stores can create
multiple memories for an experiment. Each captures the facts at storage time;
timestamps distinguish them. A timeout can leave remote write status unknown.
Search preserves scores/IDs and embeds experiment facts in content because the
search API may omit metadata. Use a dedicated assistant to avoid unrelated memories.
