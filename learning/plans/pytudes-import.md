# Pytudes Import Plan

## Status: In Progress

Import ~101 Pytudes notebooks across 8 category books using `scripts/import-pytudes.ts`.

## Books (8 total)

| # | Book | Notebooks | Imported | Ready | Status |
|---|------|-----------|----------|-------|--------|
| 1 | Programming Examples | 15 | 15 | 9 | 6 defective |
| 2 | Advent of Code | 11 | 11 | 11 | DONE ✓ |
| 3 | Probability and Uncertainty | 12 | 6 | 3 | 3 defective, 6 not started |
| 4 | Logic and Number Puzzles | 20 | 3 | 0 | 3 defective, 17 not started |
| 5 | Word Puzzles | 16 | 0 | 0 | Not started |
| 6 | The Riddler | 14 | 0 | 0 | Not started |
| 7 | Computer Science Algorithms | 8 | 0 | 0 | Not started |
| 8 | New (cross-category dupes) | 10 | 4 | 4 | Only overlaps with done books; runs last |

**~35 unique notebooks imported, ~23 ready, 12 defective, ~64 not started.**

---

## Defective Libraries

These have DB rows and partial `/tmp/markdown/<id>/` work dirs from interrupted
runs. `processMarkdownFile` skips stages whose output files already exist, so
re-running naively will **not** fix them — they need their work dirs deleted
before reprocessing (see Phase 2 below).

The `--skip-ready` flag will attempt to re-run these (they are `failed` or
`processing`, not `ready`), but they will likely fail again at the same broken
stage. That is tolerable — fix them properly in Phase 2.

| Library ID | Title | Book | Status | Issue |
|------------|-------|------|--------|-------|
| `e37320fc-d507-4d84-b7f0-0aab068d8351` | Generative Problem Solving with LLMs | Programming Examples | processing | Killed mid-reprocess |
| `e6adfe63-0e83-4930-ab58-482b3a1c75a0` | The Babylonian Number System | Programming Examples | failed | Failed to import to database |
| `9afb43df-12c2-4080-9dd5-5f8ffda0ead9` | Beal's Conjecture Revisited | Programming Examples | processing | Killed mid-reprocess |
| `ba072c41-13e7-4180-9cbe-25e91beb23d9` | Life | Programming Examples | failed | Failed to extract concepts |
| `4152036c-a3d7-428c-a824-834ac6e9fc8a` | Python Utilities for Project Euler | Programming Examples | failed | Failed to import to database |
| `8b38f4f6-9ccb-4356-900d-9070b24f9839` | Predicting Electoral Votes from Approval Polls | Programming Examples | failed | Failed to import to database |
| `4f943732-3b6e-4c18-b83d-24dae8fb9bca` | A Concrete Introduction to Probability in Python | Probability and Uncertainty | processing | Stuck (DB went down mid-run) |
| `e3a7765e-1752-451f-b997-0656985c546b` | The Diamond Game: A Probability Puzzle | Probability and Uncertainty | failed | Connection terminated unexpectedly |
| `158cba35-ac71-455d-b8b5-e86a24ae5afb` | The Devil and the Coin Flip Game | Probability and Uncertainty | failed | Connection terminated unexpectedly |
| _(unknown)_ | Counting Cluster Sizes | Logic and Number Puzzles | processing | Killed mid-first-import |
| _(unknown)_ | Cryptarithmetic Problems | Logic and Number Puzzles | processing | Killed mid-first-import |
| _(unknown)_ | Euler's Sum of Powers Conjecture | Logic and Number Puzzles | failed | Failed on first import attempt |

Also 2 orphan `Convex Hull` rows not assigned to any book (see Phase 3):
- `b9dbd750-39f4-4e11-8312-1dc8877bbeed`
- `ea7bfa3d-1fc1-40ee-90ac-dd7d03ca5ef1`

---

## Execution Plan

### Phase 1: Resume import with `--skip-ready`

`import-pytudes.ts` now supports `--skip-ready`: before spawning `process-url.ts`
for each notebook, it queries the DB and skips any whose `source_url` maps to a
`status = 'ready'` library. This avoids re-running expensive pipeline work on
the ~23 notebooks that are already good.

Result by category:
- **~23 ready libraries** — skipped instantly (`⏭` in log)
- **12 defective libraries** — will re-enter pipeline but skip to a broken
  intermediate stage (partial work dirs); may fail again. Tolerable; fixed in Phase 2.
- **~64 not-yet-imported notebooks** — fresh imports

```bash
cd /home/danenberg/prg/workshops/learning
npx tsx scripts/import-pytudes.ts --skip-ready --parallel 3 2>&1 | tee /tmp/pytudes-import-2.log
```

### Phase 2: Fix the 7 defective libraries

Delete their partial work dirs so the pipeline starts from scratch, then
reprocess. `reprocess-book.ts` handles this automatically:

```bash
cd learning

# Option A: use reprocess-book.ts (handles work-dir deletion)
npx tsx scripts/reprocess-book.ts --book "Pytudes: Programming Examples" \
  --chapters 2,7,13,15 2>&1 | tee /tmp/reprocess-prog.log

npx tsx scripts/reprocess-book.ts --book "Pytudes: Probability and Uncertainty" \
  --chapters 2,5,6 2>&1 | tee /tmp/reprocess-prob.log

# Option B: manual (if reprocess-book.ts chapter-order matching is off)
for id in \
  e6adfe63-0e83-4930-ab58-482b3a1c75a0 \
  ba072c41-13e7-4180-9cbe-25e91beb23d9 \
  4152036c-a3d7-428c-a824-834ac6e9fc8a \
  8b38f4f6-9ccb-4356-900d-9070b24f9839 \
  4f943732-3b6e-4c18-b83d-24dae8fb9bca \
  e3a7765e-1752-451f-b997-0656985c546b \
  158cba35-ac71-455d-b8b5-e86a24ae5afb; do
  rm -rf /tmp/markdown/$id /tmp/notebooks/$id
done
# Then re-run individual process-url.ts calls or import-pytudes.ts again
```

### Phase 3: Clean up orphan Convex Hull rows

Two duplicate `Convex Hull` rows were created during an earlier interrupted
run and are not assigned to any book. Delete before or after Phase 1 (the
real one will be freshly imported into Computer Science Algorithms).

```sql
DELETE FROM libraries WHERE id IN (
  'b9dbd750-39f4-4e11-8312-1dc8877bbeed',
  'ea7bfa3d-1fc1-40ee-90ac-dd7d03ca5ef1'
);
```
