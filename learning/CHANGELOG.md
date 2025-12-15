# Changelog

All notable changes to the Little PAIPer learning platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### 2024-12-15 - Notebook Processing Path Fixes and Title Extraction

**Progress:** Fixed critical path derivation bug in notebook processing and improved title extraction to use markdown headers instead of filenames.

#### Fixed
- **Path derivation bug** (`scripts/import-to-db.ts`):
  - Was deriving workDir from markdown filename: `pythonintroch1-raw.md` → `markdown/pythonintroch1-raw/` ❌
  - Now uses parent directory directly: `markdown/pythonintroch1/pythonintroch1-raw.md` → `markdown/pythonintroch1/` ✅
  - Eliminated `-raw` suffix contamination in path construction
  - Looks for artifacts in correct location: `concept-graph-enriched.json`, `chunks.json`, etc.

#### Changed
- **Improved title extraction** (`lib/processing.ts`, `scripts/import-to-db.ts`):
  - Added `extractMarkdownTitle()` helper function
  - New priority: AI metadata > first `# Header` > filename
  - Eliminates meaningless titles like "PYTHONINTROCH1"
  - Extracts human-readable titles from document structure
- **Better basename handling**:
  - Derive basename from workDir (directory name) instead of filename
  - Consistent with the fact that multiple files live in one work directory

#### Testing
- ✅ Fixed import error: "Missing file: pythonintroch1-raw/concept-graph-enriched.json"
- ✅ Now correctly finds: "pythonintroch1/concept-graph-enriched.json"
- ✅ Verified title extraction works with markdown headers
- ✅ Notebooks now display meaningful titles in UI

#### Architecture Notes
- **Work directory is authoritative** - Always the parent of the markdown file
- **Filenames are not parsed** - No more string manipulation of `-raw.md`, `-cleaned.md` suffixes
- **Title extraction is robust** - Falls back gracefully through 3 levels of quality

---

### 2024-12-14 - Bug Fixes and Zero-Install Notebook Processing

**Progress:** Fixed critical bugs in notebook processing pipeline and Socratic dialogue retry logic. Switched to `uvx` for zero-install Jupyter notebook conversion.

#### Fixed
- **Duplicate variable declarations** (`lib/processing.ts`):
  - Removed duplicate `slug` and `workDir` declarations in `processJupyterNotebook()`
  - Variables were declared twice causing esbuild transform errors
- **Retry logic bug** (`app/components/SocraticDialogue.tsx`):
  - Fixed duplicate messages appearing when retrying after API errors
  - Changed from removing 1 message to removing both failed message and error message
  - Users can now cleanly retry failed requests
- **Undefined variable reference** (`lib/processing.ts`):
  - Fixed `markdownPath` → `filePath` in `processMarkdownFile()`
  - Variable was not in function scope

#### Changed
- **Zero-install notebook conversion** (`lib/processing.ts`):
  - Changed from `jupyter nbconvert` to `uvx --from jupyter-core jupyter nbconvert`
  - No longer requires global Jupyter installation
  - Uses `uv` package runner (Python equivalent of `npx`)
  - Consistent with modern Python tooling
  - Updated error message to point to uv installation docs
  
#### Testing
- ✅ Verified notebook download and conversion pipeline works end-to-end
- ✅ Tested retry button with simulated API failures (30% random failure rate)
- ✅ Confirmed duplicate messages no longer appear on retry
- ✅ Validated error handling provides clear feedback

#### Architecture Notes
- **Assumes `uv` available in deployment environment** - Will be added to Dockerfile/Cloud Run config
- **Notebooks still convert via markdown** - Correct approach for semantic segmentation
- **Retry logic now production-ready** - Properly handles failed API requests

---

### 2024-12-12 - Clean URLs with Dynamic Routes

**Progress:** Refactored routing to use Next.js dynamic routes with clean URLs. Home page now shows library selector, individual libraries accessible at `/library/{slug}`.

#### Changed
- **Simplified home page** (`app/page.tsx`):
  - Removed all library detail view logic
  - Now only renders `LibrarySelector` component
  - Navigates to `/library/{id}` on selection
- **Created dynamic route** (`app/library/[slug]/page.tsx`):
  - Moved all library detail view logic from home page
  - Uses Next.js 15+ `params` Promise with `React.use()`
  - Handles invalid library IDs with redirect to home
  - Maintains localStorage sync for recent library

#### Fixed
- **Next.js 15+ params handling**: Properly unwrap `params` Promise with `React.use()` hook
- **URL structure**: Changed from `/?library=sudoku` to `/library/sudoku`

#### Architecture
```
Before: /?library=sudoku (query param)
After:  /library/sudoku (clean URL)

Routes:
  /                    → LibrarySelector
  /library/[slug]      → ConceptGraph + Details + Socratic Dialogue
```

#### Status
- ✅ Clean semantic URLs working
- ✅ Direct linking to libraries functional
- ✅ Back button navigates correctly
- ✅ Ready for shareable library links

---

### 2024-12-12 - Jupyter Notebook Pipeline & API Optimizations

**Progress:** Jupyter notebooks can now be processed from GitHub URLs! Full pipeline converts notebooks to markdown and processes through existing markdown pipeline. Also fixed critical API performance issue with markdown content duplication.

#### Added
- **Notebook processing pipeline** (`lib/processing.ts`):
  - `processJupyterNotebook()` - handles both URLs and local files
  - Automatic GitHub blob → raw URL conversion
  - Downloads notebooks to `temp/notebooks/`
  - Converts `.ipynb` → `.md` (extracts markdown cells, code cells, outputs)
  - Delegates to `processMarkdownFile()` for concept extraction and embedding
- **CLI script updates** (`scripts/process-notebook.ts`):
  - Accepts GitHub URLs: `npx tsx scripts/process-notebook.ts https://github.com/norvig/pytudes/blob/main/ipynb/Sudoku.ipynb`
  - Accepts local paths: `npx tsx scripts/process-notebook.ts ./notebook.ipynb`
  - Clear usage examples in help text

#### Changed
- **API performance optimization** (`app/api/socratic-dialogue/route.ts`):
  - Moved `markdown_content` from per-source to response level
  - Prevents sending same multi-MB markdown document multiple times (was 10MB for 5 sources, now 2MB)
  - Only fetches library when sources are present
  
#### Fixed
- **Scope error in Socratic dialogue API**: `library` variable now properly defined in POST function scope
- **Markdown content duplication**: Each source was including full document; now sent once at response level
- **Edge format inconsistency**: Removed `{source, target}` fallback in import script
  - Import now enforces canonical `{from, to}` format from schema
  - Imported proper `ConceptGraph` type from `types.ts`
  - Eliminated technical debt from format workarounds

#### Status
- ✅ Notebook processing works end-to-end (URL → download → convert → markdown pipeline)
- ✅ API optimized for large documents
- 🚧 Markdown pipeline still needs: enrich → map → embed → import stages
- 🎯 Ready to process Peter Norvig's pytudes notebooks!

#### Next Steps
1. Complete markdown pipeline remaining stages
2. Test notebook processing with real pytudes examples
3. Verify database import works for notebook-sourced content

---

### 2024-12-12 - Markdown Pipeline Foundation

**Progress:** Markdown concept extraction and chunking now integrated into `lib/processing.ts`. Pipeline uses dedicated markdown scripts instead of repurposing YouTube scripts.

#### Changed
- **Markdown processing pipeline** (`lib/processing.ts`):
  - Stage 1 (20%): Calls `scripts/markdown/extract-concepts.ts` with full markdown file
  - Stage 2 (40%): Calls `scripts/markdown/chunk-markdown.ts` to create semantic segments
  - Removed YouTube script repurposing (was creating fake video-analysis.json)
  - Stages 3-6 marked as TODO (enrich, map, embed, import)

#### Status
- ✅ Concept extraction working (30 concepts from tsp.md)
- ✅ Chunking working (4 chunks created, quality needs investigation)
- ⚠️ Only 4 chunks from 74KB file (expected ~20-50) - needs debugging
- 🚧 Remaining stages: enrich → map segments → embed → import to DB

#### Next Steps
1. Investigate low chunk count (4 from 74KB is suspicious)
2. Create `scripts/markdown/map-segments-to-concepts.ts`
3. Adapt embedding script for markdown chunks
4. Create `scripts/import-markdown-to-db.ts`

---

### 2024-12-14 - Socratic Dialogue UX Improvements

**Progress:** Fixed critical retry logic bug and tested error handling flow end-to-end.

#### Fixed
- [x] **Retry button duplicate messages bug** - Changed slice logic from `-1` to `-2` to remove both failed user message and error message ✅
- [x] **Tested error handling with simulated failures** - Verified retry flow works correctly with random 30% failure rate ✅
- [x] **Production-ready retry logic** - Users can now cleanly retry failed API requests without UI artifacts ✅

---

### 2024-12-12 - YouTube End-to-End with Shared Embedding Library

**Major milestone:** YouTube video processing now works completely end-to-end with database-backed 1536D embeddings and shared utilities for future content types.

#### Added
- **Shared embedding library** (`lib/embeddings.ts`):
  - `generateEmbeddings()` - batch embedding generation with rate limiting
  - `generateQueryEmbedding()` - single query embedding for search
  - Gemini REST API with explicit `outputDimensionality: 1536`
  - Proper rate limiting (100ms between requests)
- **Shared markdown chunking** (`lib/markdown-chunker.ts`):
  - `chunkMarkdownFile()` - semantic chunking with Gemini
  - `splitIntoSections()` - header-based section splitting
  - Structured output with Zod schemas
  - Preserves section hierarchy and code blocks

#### Changed
- **YouTube embedding generation**: Updated `scripts/youtube/embed-video-segments.ts` to use shared `lib/embeddings.ts`
- **Database import**: Fixed integer type issues (rounded timestamps/durations to match schema)
- **Video segment queries**: Properly return multimodal content with 1536D embeddings

#### Fixed
- **Embedding dimensions**: Changed from 3072D (default) to 1536D to match pgvector schema
- **Syntax errors**: Fixed missing braces in JSON.stringify calls
- **Type mismatches**: Rounded float timestamps to integers for database

#### Architecture
```
YouTube Pipeline (✅ WORKING):
  Video → Transcript → Concepts → Enrichment → Embeddings (1536D) → Database

Shared Libraries:
  - lib/embeddings.ts (YouTube ✅, Markdown 🚧)
  - lib/markdown-chunker.ts (✅ tested with TSP)

Markdown Pipeline (🚧 IN PROGRESS):
  Markdown → Chunks → Concepts → Enrichment → Embeddings (1536D) → Database
  
Status: YouTube working, Markdown needs dedicated scripts (can't reuse YouTube scripts)
```

#### Testing
- ✅ Processed video: "Getting Started with Python in Less Than 10 Minutes" (fWjsdhR3z3c)
- ✅ Semantic search returns 5 relevant segments with 62.3% top similarity
- ✅ Full multimodal context (timestamps, transcripts, visuals, code, concepts)
- ✅ Socratic tutor receives rich teaching material (~2014 tokens)

---

### 2024-12-11 - Database-Backed Multimodal Content

**Major milestone:** Completed migration from on-disk JSON files to database-backed embeddings with full multimodal content support. This enables dynamic content uploads and rich teaching material for the Socratic dialogue system.

#### Added
- **Multimodal segment retrieval**: `search_segments()` database function now returns rich content:
  - `audio_start`, `audio_end` - precise timestamp boundaries
  - `visual_description` - what's shown in video frames
  - `code_content` - extracted code from the segment
  - `slide_content` - presentation slides if visible
  - `key_concepts` - identified concepts for each segment
- **Mastery indicators support**: 
  - Added `mastery_indicators` column to `concepts` table
  - Updated `get_concept_graph()` to include mastery indicators in API responses
  - Full pedagogical metadata now flows from enriched JSON → database → frontend

#### Changed
- **Import pipeline**: Updated `import-youtube-to-db.ts` to read from `concept-graph-enriched.json` (was `concept-graph.json`)
  - Now imports learning objectives, mastery indicators, and common misconceptions
  - Maintains idempotency for iterative development
- **Socratic dialogue API**: Fixed `/api/socratic-dialogue/route.ts` to:
  - Use correct field names (`segment_timestamp` instead of `timestamp`)
  - Assemble rich multimodal context from all available fields
  - Format timestamps as MM:SS or H:MM:SS (was showing NaN:NaN)
  - Build comprehensive teaching material combining transcript, visuals, code, and concepts

#### Fixed
- **Timestamp display**: Segments now show proper timestamps (e.g., "49:02") instead of "NaN:NaN"
- **Context truncation**: Socratic tutor now receives full 8,500+ character context (~2,126 tokens) instead of truncated fragments
- **Missing pedagogical data**: Learning objectives and mastery indicators now properly flow through the entire stack

#### Technical Details
- **Schema changes**: `schema.sql` updated with multimodal fields and mastery_indicators
- **Query optimization**: Vector similarity search now returns comprehensive segment data in a single query
- **Type safety**: All multimodal fields properly typed in TypeScript interfaces
- **Testing**: Verified with "PyTorch Tensors" concept from Karpathy GPT video

#### Impact
The Socratic dialogue system now has:
- ✅ Rich teaching material with code examples and visual context
- ✅ Structured learning objectives (5 per concept)
- ✅ Measurable mastery indicators (4 skill assessments per concept)
- ✅ Video provenance with accurate timestamps
- ✅ Semantic search across multimodal content

This completes **Phase 1** of the database migration, enabling the workshop use case where attendees can upload YouTube videos for processing.

---

## [0.1.0] - 2024-11-12

### Initial Release
- YouTube video processing pipeline
- Concept extraction with Gemini
- Static file-based learning modules (PAIP, TSP)
- Socratic dialogue with RAG
- Python scratchpad with Pyodide
- Concept graph visualization
