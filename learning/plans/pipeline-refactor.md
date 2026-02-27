# Pipeline Refactor + Frontloaded Metadata

## The Problems

### 1. Ugly import experience
Title and slug are derived from the URL filename (`chapter1.md` → title
"chapter1", slug "chapter1"). The real title only arrives at the end of
processing. The slug is immutable, so it stays garbage forever.

### 2. Metadata extraction only in notebook pipeline
`extractMetadata()` (LLM-based title/description/author extraction) exists
at stage 2.5 of the notebook pipeline but is completely absent from the
markdown pipeline. There's no good reason — notebooks just convert to
markdown and then run the same steps.

### 3. Massive duplication
The notebook pipeline copy-pastes all 6 markdown processing steps (extract
concepts, chunk, enrich, map, embed, import) instead of calling
`processMarkdownFile()`. Any improvement to one doesn't reach the other.

### 4. Progress UI mismatches
Progress messages don't always match the stage labels the frontend expects,
causing the UI to show 5% or skip stages.

---

## The Solution: Three Layers

### Layer 1: Frontload metadata extraction into the publish route

At publish time (before the library row is created):

```
User submits URL on /publish
  → Download file (markdown: raw download; notebook: download + nbconvert → markdown)
  → Call extractMetadata() → get {title, description, author, topics, level, estimated_hours}
  → Generate slug from LLM-quality title ("Introduction to Lisp" → "introduction-to-lisp")
  → Save extracted-metadata.json to /tmp/markdown/<libraryId>/
  → Create library row with good title, description, author, slug
  → Redirect user → /users/klutometis/introduction-to-lisp
  → Spawn background processing (which skips metadata extraction since file already exists)
```

Cost: ~5-10 seconds of Gemini Flash on the publish button. Show a spinner
like "Analyzing content..." on the publish form.

Fallback chain if LLM fails:
`extractMarkdownTitle()` (first `#` header) → filename → URL-derived title.

### Layer 2: Add metadata extraction to `processMarkdownFile()`

Add `extractMetadata()` as a new early stage in `processMarkdownFile()`,
between download and concept extraction. Make it idempotent — if
`extracted-metadata.json` already exists in the work dir (because the
publish route already did it), skip it.

This means:
- If called from the publish route (metadata already extracted): skips, zero cost
- If called from `process-url.ts` CLI script: runs it, gets good metadata
- If called from the notebook pipeline (after refactor): gets metadata for free

Include `extractedMetadata` in the `ProcessingResult` return value (the
markdown pipeline currently doesn't return this — only notebooks do).

### Layer 3: Refactor notebook pipeline to call `processMarkdownFile()`

`processJupyterNotebook()` becomes:

```
1. Download .ipynb (if URL)
2. Convert notebook → markdown (raw + cleaned)
3. Call processMarkdownFile(cleanedMarkdownPath, libraryId, wrappedProgress)
   → which internally does: metadata → concepts → chunk → enrich → map → embed → import
4. Additionally import the notebook data (source_type='notebook', notebook_data)
5. Return result
```

The notebook pipeline shrinks from ~300 lines to ~80 lines. The duplicated
stages 3a-3e (currently lines 851-942 of processing.ts) are deleted entirely.
Any future improvement to the markdown pipeline automatically benefits
notebooks.

---

## Changes, File by File

### `lib/processing.ts`

| Change | Details |
|---|---|
| Export `downloadFile()` | Currently private. Needed by publish route. |
| Export `githubBlobToRaw()` | Currently private. Needed by publish route for URL conversion. |
| Export `extractMarkdownTitle()` | Currently private. Needed as fallback in publish route. |
| Export `convertNotebookToMarkdown()` | Currently private. Needed by publish route for notebook URLs. |
| Export `cleanMarkdownForLLM()` | Currently private. Needed by publish route. |
| Add metadata extraction stage to `processMarkdownFile()` | New stage between download and concept extraction (~15% progress). Calls `extractMetadata()` if `extracted-metadata.json` doesn't exist. Reads it back and includes in return value. Non-fatal on failure. |
| Include `extractedMetadata` in markdown `ProcessingResult` | Currently only notebook returns this. Read from `extracted-metadata.json` at the end and populate the return value. |
| Refactor `processJupyterNotebook()` | Remove duplicated stages 3a-3e. After notebook download + conversion, call `processMarkdownFile(cleanedMarkdownPath, libraryId, wrappedProgress)`. Then handle the notebook-specific DB import (source_type, notebook_data). |
| Fix `ProcessingResult.libraryId` | Currently set to `slug` instead of the actual UUID. Fix to return the actual `libraryId` parameter. |
| Delete `extractCodeBlocks()` | Dead code, never called. |

### `app/api/publish/route.ts`

| Change | Details |
|---|---|
| Download content at publish time | For markdown URLs: `downloadFile()` to temp dir. For notebook URLs: `downloadFile()` + `convertNotebookToMarkdown()`. For YouTube: no change (already fetches metadata). |
| Call `extractMetadata()` | On the downloaded/converted markdown content. Use the returned `title` for slug generation. |
| Save `extracted-metadata.json` | To the work dir (`/tmp/markdown/<libraryId>/`). The background pipeline will find it and skip re-extraction. |
| Update library row creation | Use LLM title, description, author instead of placeholders. |
| Fallback chain | Try/catch around the whole thing. On failure: `extractMarkdownTitle()` → filename-derived title. |

### `app/publish/page.tsx`

| Change | Details |
|---|---|
| Better loading state | Change "Publishing..." to "Analyzing content..." or a two-phase indicator since the publish call now takes ~10s instead of ~1s. |

### `LibraryStatusPage.tsx`

| Change | Details |
|---|---|
| Add new stages | Add "Downloading" and "Extracting metadata" to the markdown PROCESSING_STAGES list. Renumber percentages to accommodate. |
| Keep notebook stages aligned | After refactor, notebook stages should match markdown stages (minus the convert step). |

### `scripts/process-url.ts`

| Change | Details |
|---|---|
| Use `extractMetadata()` for title | Instead of `extractTitleFromUrl()`, download the file and call `extractMetadata()` for a proper title/slug — same as the publish route. Fallback to current behavior on failure. |

---

## Updated Stage Progression

### Markdown (after refactor)

```
{ key: 'download',  label: 'Downloading content',        percent: 5  },
{ key: 'metadata',  label: 'Extracting metadata',        percent: 10 },
{ key: 'extract',   label: 'Extracting concepts',        percent: 25 },
{ key: 'chunk',     label: 'Chunking markdown',          percent: 40 },
{ key: 'enrich',    label: 'Enriching concepts',         percent: 60 },
{ key: 'map',       label: 'Mapping chunks to concepts', percent: 70 },
{ key: 'embed',     label: 'Generating embeddings',      percent: 85 },
{ key: 'import',    label: 'Importing to database',      percent: 95 },
```

### Notebook (after refactor)

```
{ key: 'download',  label: 'Downloading notebook',       percent: 5  },
{ key: 'convert',   label: 'Converting to markdown',     percent: 15 },
{ key: 'metadata',  label: 'Extracting metadata',        percent: 20 },
{ key: 'extract',   label: 'Extracting concepts',        percent: 30 },
{ key: 'chunk',     label: 'Chunking content',           percent: 45 },
{ key: 'enrich',    label: 'Enriching concepts',         percent: 60 },
{ key: 'map',       label: 'Mapping chunks to concepts', percent: 75 },
{ key: 'embed',     label: 'Generating embeddings',      percent: 85 },
{ key: 'import',    label: 'Importing to database',      percent: 95 },
```

---

## User Experience: Before vs After

### Before (current)

```
1. Submit https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md
2. [instant redirect] → /users/klutometis/chapter1
3. Title: "chapter1", Author: "Unknown", Description: (none)
4. [10-30 min processing]
5. Title updates to "Introduction to Lisp" but slug stays "chapter1" forever
```

### After (refactored)

```
1. Submit https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md
2. [~10 second spinner: "Analyzing content..."]
3. Redirect → /users/klutometis/introduction-to-lisp
4. Title: "Introduction to Lisp", Author: "Peter Norvig",
   Description: "Learn Lisp fundamentals..."
5. [10-30 min processing] — all stages shown correctly in progress UI
6. Done — everything was correct from the start
```

---

## Execution Order

1. `lib/processing.ts` — export private functions, add metadata stage to
   markdown pipeline, refactor notebook pipeline
2. `app/api/publish/route.ts` — frontload metadata extraction, use LLM
   title for slug
3. `app/publish/page.tsx` — better loading state
4. `LibraryStatusPage.tsx` — update stage lists
5. `scripts/process-url.ts` — use `extractMetadata()` for title
6. Test end-to-end with a PAIP chapter URL

---

## Risks / Edge Cases

### Gemini API key missing at publish time
Fall back to `extractMarkdownTitle()` → filename. Non-fatal.

### Large files taking too long at publish time
`extractMetadata` truncates to 50k chars, so even huge files should complete
in 5-10s. If it times out, fall back.

### Notebook conversion at publish time
`nbconvert` needs to be available. In local dev it should be (via `uvx`).
In production, the publish route shouldn't be converting notebooks — that's
the background processor's job. We may want to limit the publish-time
metadata extraction to markdown only, and let notebooks use the first few
cells as a title hint instead. This is a tradeoff to revisit if needed.

### Work dir coordination
The publish route creates `/tmp/markdown/<libraryId>/extracted-metadata.json`.
The background process needs to find the same dir. Since `libraryId` is the
UUID and both use `/tmp/markdown/<libraryId>/`, this works in local dev.

In Cloud Run (where the publish route and processor run in different
containers), this wouldn't work — but Cloud Run uses `PROCESSING_MODE=job`
which means metadata extraction would need to happen in the processor anyway.
The idempotent `extracted-metadata.json` check handles both cases.

---

## Key Design Principles

1. **`processMarkdownFile()` is the single source of truth** for processing
   markdown content. Notebooks call it; they don't duplicate it.

2. **Metadata extraction is idempotent** — if `extracted-metadata.json`
   exists, skip the LLM call. This lets the publish route pre-compute it
   without the pipeline wasting time re-computing it.

3. **Fallback chains everywhere** — LLM fails? Use `#` header. No header?
   Use filename. Never show garbage.

4. **The slug is derived from the best title available at creation time.**
   With LLM metadata frontloaded, this is always a good title.

---

## Status

- [x] Export private functions from `lib/processing.ts`
- [x] Add metadata extraction stage to `processMarkdownFile()`
- [x] Include `extractedMetadata` in markdown `ProcessingResult`
- [x] Refactor `processJupyterNotebook()` to call `processMarkdownFile()`
- [x] Fix `ProcessingResult.libraryId` (slug → actual UUID)
- [x] Delete dead `extractCodeBlocks()`
- [x] Frontload metadata in `app/api/publish/route.ts`
- [x] Update publish form loading state in `app/publish/page.tsx`
- [x] Update `PROCESSING_STAGES` in `LibraryStatusPage.tsx`
- [x] Update `scripts/process-url.ts` to use `extractMetadata()`
- [ ] Test end-to-end with PAIP chapter URL
