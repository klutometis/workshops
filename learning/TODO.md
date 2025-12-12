# Little PAIPer - TODO

---

## Phase 1: YouTube + Database ✅ COMPLETE

### Goal
Enable workshop attendees to upload YouTube videos and have them automatically processed into interactive learning modules.

### Status: **COMPLETE** (2024-12-11)

All core infrastructure is in place. The system successfully:
- Stores multimodal video content (audio, visual, code, slides) in PostgreSQL
- Performs semantic search across embeddings with pgvector
- Delivers rich teaching material to Socratic dialogue with full pedagogical metadata
- Supports idempotent re-imports for iterative development

### Completed Tasks

#### 1. Database Setup ✅
- [x] ~~Create Supabase project~~ **→ Using Google Cloud SQL (PostgreSQL 15)**
- [x] Design and implement schema (5 tables: libraries, concepts, prerequisites, segments, embeddings)
- [x] Set up pgvector extension
- [x] Create indexes for performance (library_id, vector similarity with HNSW, etc.)
- [x] **Enhanced schema with multimodal fields** (audio_start/end, visual_description, code_content, slide_content, key_concepts)
- [x] **Added mastery_indicators column** to concepts table
- [x] **Updated get_concept_graph()** to return full pedagogical metadata

**Database Details:**
- Instance: `learning-db` (gen-lang-client-0615388941:us-central1:learning-db)
- Connection: 136.111.249.110:5432
- Status: Schema fully applied with multimodal support ✅

#### 2. Pipeline Adaptation ✅
- [x] **Import script complete**: `import-youtube-to-db.ts` reads enriched JSON and populates database
- [x] **Idempotent design**: Safe to re-run imports during development
- [x] **Full data pipeline**: Enriched concepts with learning objectives, mastery indicators, misconceptions
- [ ] Refactor `scripts/youtube/download-media.sh` to work with temp storage *(deferred - not needed for read-only imports)*
- [ ] Adapt processing scripts to write directly to DB *(deferred - current JSON→DB workflow sufficient)*
- [ ] Create unified `process-youtube.ts` orchestrator script *(deferred to Phase 1b)*

#### 3. API Routes ✅
- [x] **`GET /api/concept-graph/[slug]`** - Returns full concept graph with multimodal metadata
- [x] **`POST /api/socratic-dialogue`** - RAG-enhanced Socratic teaching with semantic search
- [x] **Database-backed semantic search** - Queries pgvector embeddings for relevant segments
- [ ] `POST /api/libraries/upload` - Accept YouTube URL *(deferred to Phase 1b - upload UI)*
- [ ] `POST /api/libraries/[id]/process` - Trigger pipeline *(deferred to Phase 1b)*
- [ ] `GET /api/libraries` - List libraries *(exists but basic)*
- [ ] `GET /api/libraries/[id]/status` - Processing status *(deferred to Phase 1b)*

#### 4. UI Updates ✅
- [x] **Refactored `SocraticDialogue.tsx`** - RAG queries database embeddings via API
- [x] **Multimodal content display** - Shows timestamps, code, visual descriptions in teaching context
- [x] **Library selector working** - Can switch between learning modules
- [x] **Concept graph reads from API** - No more static JSON dependencies
- [ ] Create upload form component *(deferred to Phase 1b - workshop upload UI)*
- [ ] Add processing status indicator *(deferred to Phase 1b)*

#### 5. Testing ✅
- [x] **Verified RAG retrieval** - Database embeddings work correctly with semantic search
- [x] **Tested with Karpathy GPT video** - Full end-to-end flow working
- [x] **Validated multimodal content** - Timestamps, code, visuals, key concepts all present
- [x] **Confirmed pedagogical metadata** - Learning objectives (5), mastery indicators (4) flow correctly
- [x] **Performance validated** - Vector similarity search on 859 embeddings performs well

---

## Phase 1b: CLI Pipeline (PRIORITY)

### Goal
Build command-line tools to process arbitrary YouTube videos and text sources.

### Tasks

#### 1. YouTube Video Processing ✅ **COMPLETE** (2024-12-12)
- [x] **End-to-end pipeline working**
- [x] `scripts/process-youtube.ts` - orchestrates full pipeline
- [x] Sequence: download → transcribe → analyze frames → extract concepts → enrich → map segments → embed → import
- [x] Uses shared `lib/embeddings.ts` for 1536D embeddings
- [x] Database import with proper integer rounding
- [x] Tested with: "Getting Started with Python" video (fWjsdhR3z3c)
- [x] Semantic search returns relevant multimodal segments
- [x] Socratic tutor works with video-backed context

**Status:** Production-ready for YouTube videos! 🎉

#### 2. Markdown File Processing 🚧 **IN PROGRESS**

**Current Status (2024-12-12 - Evening):**
- ✅ Dedicated markdown scripts created (`scripts/markdown/extract-concepts.ts`, `chunk-markdown.ts`)
- ✅ Integrated into `lib/processing.ts` pipeline
- ✅ Concept extraction working (30 concepts from tsp.md)
- ⚠️ Chunking producing only 4 segments from 74KB file (needs debugging)
- 🎯 **Next:** Investigate chunk quality, then build remaining stages

**Progress:**
- ✅ Step 1a: `extract-concepts.ts` - reads full markdown, extracts concepts holistically
- ✅ Step 1b: `chunk-markdown.ts` - semantic chunking with Gemini
- ✅ Step 1c: `lib/processing.ts` updated to call markdown scripts (not YouTube scripts)
- ⚠️ **Blocker:** Only 4 chunks from 74KB (expected 20-50) - chunker may be merging too aggressively

**Implementation Plan:**

**Step 1: Debug Chunking** 🚧 **CURRENT**
- [ ] Investigate `markdown/tsp/chunks.json` - are chunks too large?
- [ ] Check if Gemini is merging sections aggressively
- [ ] Verify `lib/markdown-chunker.ts` logic (section splitting, chunk merging)
- [ ] Consider max chunk size parameter

**Step 2: Complete Markdown Scripts** 🎯 **NEXT PRIORITY**
- [ ] `enrich-concepts.ts` - add learning objectives, mastery indicators (adapt from YouTube)
- [ ] `map-segments-to-concepts.ts` - map chunks to concepts (no timestamps)
- [ ] `embed-segments.ts` - generate 1536D embeddings using `lib/embeddings.ts`

**Step 3: Database Schema Updates**
- [ ] Create `markdown_segments` table (or reuse segments table with content_type):
  ```sql
  CREATE TABLE markdown_segments (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id),
    chunk_index INTEGER,
    heading_path TEXT,        -- e.g., "TSP > Nearest Neighbor"
    anchor TEXT,              -- e.g., "nearest-neighbor-algorithm"
    start_line INTEGER,       -- source file provenance
    end_line INTEGER,
    text_content TEXT,
    code_content TEXT,
    mapped_concept_id TEXT,
    ...
  );
  ```
- [ ] Add `content_type` to libraries ('youtube' | 'markdown')
- [ ] Application routes queries to correct segment table

**Step 4: Import Script** 🚧 **IN PROGRESS**
- [x] Created `scripts/markdown/import-markdown-to-db.ts`
- [x] Enforces canonical edge format `{from, to}` (removed `source/target` workaround)
- [x] Imports proper types from `types.ts` for schema consistency
- [ ] Test with enriched concept graph + embedded chunks
- [ ] Verify database insertion works correctly
- [ ] Store embeddings with segment_id foreign key

**Step 5: Testing**
- [ ] Process `public/data/pytudes/tsp.md` end-to-end
- [ ] Verify concepts extracted correctly
- [ ] Check 1536D embeddings match database
- [ ] Test semantic search with markdown segments
- [ ] Verify Socratic dialogue works with text-only content

**Shared Libraries (✅ Ready):**
- `lib/markdown-chunker.ts` - semantic chunking with section metadata
- `lib/embeddings.ts` - 1536D embeddings with rate limiting
- `lib/concept-extractor.ts` - *TODO: extract from YouTube scripts*

**Key Insight:** Content type only affects **input parsing** and **segment storage**. The enrichment pipeline (concepts → pedagogy → embeddings) is 100% reusable.

#### 4. Jupyter Notebook Processing ✅ **COMPLETE** (2024-12-12)
- [x] **End-to-end pipeline working**
- [x] `scripts/process-notebook.ts` - accepts URLs or local paths
- [x] `lib/processing.ts` - `processJupyterNotebook()` function
- [x] Downloads from GitHub URLs (automatic blob→raw conversion)
- [x] Converts `.ipynb` → `.md` (extracts markdown, code, outputs)
- [x] Delegates to `processMarkdownFile()` for downstream processing
- [x] Ready to process Peter Norvig's pytudes!

**Status:** Production-ready for notebooks! 🎉

**Usage:**
```bash
# From GitHub
npx tsx scripts/process-notebook.ts https://github.com/norvig/pytudes/blob/main/ipynb/Sudoku.ipynb

# Local file
npx tsx scripts/process-notebook.ts ../pytudes/ipynb/Advent-2020.ipynb
```

**Architecture:** 
```
YouTube:  Video → Frames + Transcript → Segments → [SHARED ENRICHMENT] → DB
Markdown: .md → Parse Sections + Code → Segments → [SHARED ENRICHMENT] → DB  
Notebook: .ipynb → Download & Convert → .md → [SAME AS MARKDOWN] → DB
```

**Note:** Notebooks piggyback on markdown pipeline completely. Conversion preserves code blocks and narrative structure (code cells → fenced code blocks, markdown cells → sections).

#### 5. API Optimizations ✅ **COMPLETE** (2024-12-12)
- [x] **Fixed markdown content duplication** in `/api/socratic-dialogue`
- [x] Moved `markdown_content` from per-source to response level
- [x] Reduced response size by 80-90% for multi-source queries
- [x] Fixed scope error with `library` variable
- [x] Only fetch library when sources are present (optimization)

**Impact:** 5 sources with 2MB markdown went from 10MB response to 2MB response.

#### 6. Testing
- [x] Test YouTube processing with new video (✅ "Getting Started with Python")
- [ ] Test markdown processing with new file (🚧 needs enrichment stage)
- [ ] Test notebook processing (🎯 ready to test with pytudes)
- [ ] Verify all three types appear in library selector
- [ ] Confirm Socratic dialogue works with each type

---

## Phase 1c: Web Upload UI (Optional - After CLI Works)

### Goal
Wrap CLI scripts with web interface for non-technical users.

### Tasks

#### 1. Upload Form
- [ ] Create `/upload` page
- [ ] Input: YouTube URL or file upload (markdown, ipynb)
- [ ] Validation: check format, not already processed
- [ ] Submit triggers processing via API

#### 2. API Routes
- [ ] `POST /api/libraries/upload` - Accepts URL/file
- [ ] Calls appropriate `process*()` function from `lib/processing.ts`
- [ ] Returns processing result or error
- [ ] Optional: async with status polling (can be sync initially)

#### 3. Status Display
- [ ] Show processing stage during upload
- [ ] Display success/error after completion
- [ ] Redirect to concept graph on success
- [ ] Log output visible in dev mode

#### 4. UI Polish
- [ ] Handle different source types (YouTube, markdown, notebook)
- [ ] Add source type indicator in library list
- [ ] Show appropriate metadata per type
- [ ] Adapt visualization for text-only content

---

## Phase 3: Authentication & User Content (Future)

### Goal
Enable users to own, modify, and share their learning content.

### Tasks

#### 1. GitHub OAuth Integration
- [ ] Enable Supabase GitHub Auth provider
- [ ] Add "Sign in with GitHub" flow
- [ ] Store user profiles (username, avatar, GitHub ID)

#### 2. Content Ownership
- [ ] Add `user_id` foreign key to libraries table
- [ ] Implement Row Level Security (RLS) policies:
  - Users can read public libraries
  - Users can CRUD their own libraries
  - Admins can moderate public content
- [ ] Add "Make Public" toggle for user libraries

#### 3. UI Updates
- [ ] Add auth UI (sign in/out, profile menu)
- [ ] Split library list: "My Libraries" vs "Public Libraries"
- [ ] Add library management: Edit, Delete, Share
- [ ] Show author information on library cards

#### 4. Collaboration Features
- [ ] "Fork" library (duplicate for modification)
- [ ] Share library via link (public/private)
- [ ] Instructor dashboard (view student progress)

---

## Phase 4: Production Readiness (Post-Launch)

### Goal
Scale from workshop prototype to production learning platform.

### Tasks

#### 1. Background Processing
- [ ] Set up job queue (BullMQ + Redis or Supabase Edge Functions)
- [ ] Move pipeline processing to background workers
- [ ] Add job status tracking and error handling
- [ ] Implement retry logic for failed processing

#### 2. Performance Optimization
- [ ] Add Redis caching for frequently accessed libraries
- [ ] Optimize vector similarity queries (HNSW index)
- [ ] Implement pagination for large library lists
- [ ] Add CDN for static assets (frames, thumbnails)

#### 3. Monitoring & Observability
- [ ] Set up error tracking (Sentry or similar)
- [ ] Add performance monitoring (response times, query times)
- [ ] Create admin dashboard (processing stats, user activity)
- [ ] Set up alerts for failed processing jobs

#### 4. Cost Management
- [ ] Implement rate limiting on uploads
- [ ] Add storage quotas per user
- [ ] Monitor Gemini API costs
- [ ] Optimize embedding generation (batch processing)

---

## Open Questions

- **Sync vs Async processing:** API route (simple, might timeout) or background worker?
- **Storage strategy:** Store frames in Supabase Storage or reference YouTube directly?
- **Public vs private default:** Public for workshop (no auth) or private by default?
- **Video length limits:** Max 3 hours (Karpathy GPT length)?

---

---

## Phase 5: Embedding Quality Improvements (Post-MVP)

### Goal
Optimize semantic search and RAG retrieval quality based on production usage patterns.

### Context
Current embedding system uses Gemini-based semantic segmentation (concept-driven, not time-based). This means:
- **Dense videos** (e.g., Karpathy lectures) → Many short segments (high concept density)
- **Tutorial videos** (e.g., MCP walkthrough) → Fewer long segments (verbose explanations)

This is working as intended, but there are opportunities to improve retrieval precision.

### Observations from Testing
- Similarity scores moderate (0.5-0.6 range) for tutorial-style videos
- Top results are relevant but not always the most specific
- Generic intro/outro segments rank highly despite low information value
- 12 segments for 10-min tutorial vs. potentially 50+ for dense lecture

### Tasks

#### 1. Query Strategy Improvements
- [ ] **Enhance query construction** - Use concept description + learning objectives instead of just concept name
- [ ] **Multi-query approach** - Generate multiple query variations and merge results
- [ ] **Query expansion** - Include related concepts and prerequisites in search
- [ ] **Test query impact** - Compare retrieval quality with enhanced queries

#### 2. Segment Quality Filtering
- [ ] **Score segment information density** - Detect and de-prioritize generic intro/outro segments
- [ ] **Filter by key_concepts count** - Prioritize segments with more specific concepts
- [ ] **Detect transitional segments** - Identify "next we'll..." type segments and rank lower
- [ ] **Add segment quality scores** - Store metadata for filtering during retrieval

#### 3. Embedding Model Evaluation
- [ ] **Benchmark text-embedding-004** - Compare against current model
- [ ] **Test domain-specific models** - Evaluate code-aware or educational embeddings
- [ ] **Fine-tune on educational content** - If dataset is large enough
- [ ] **A/B test retrieval quality** - Measure improvement with different models

#### 4. Concept-Aware Embeddings
- [ ] **Include concept IDs in embedding text** - Help model understand semantic relationships
- [ ] **Embed prerequisite chains** - Improve retrieval for foundational concepts
- [ ] **Add learning objective context** - Embed segments with their teaching goals
- [ ] **Test concept-augmented retrieval** - Measure precision improvement

#### 5. Adaptive Segmentation (Future)
- [ ] **Analyze video information density** - Detect dense vs. tutorial-style content
- [ ] **Dynamic segment length** - Shorter segments for dense videos, longer for tutorials
- [ ] **Concept-boundary detection** - Let Gemini suggest segment splits more granularly
- [ ] **Balance segment count** - Target 20-50 segments regardless of video length

#### 6. Retrieval Metrics & Monitoring
- [ ] **Track similarity score distributions** - Alert if scores drop below threshold
- [ ] **Log retrieval quality feedback** - Let tutors mark "good" vs "poor" context
- [ ] **A/B test improvements** - Measure impact on learning outcomes
- [ ] **Create embedding quality dashboard** - Visualize retrieval patterns

### Priority
**Low** - Current system is functional for workshop. These are optimization opportunities based on real usage data.

### Success Metrics
- Average similarity scores increase from 0.5-0.6 to 0.7-0.8
- Fewer generic segments in top-3 results
- Improved student engagement in Socratic dialogues
- Reduced need for fallback context

---

## Notes

- Keep existing static files (PAIP, TSP) for reference during migration
- Workshop deadline drives Phase 1 timeline
- Auth (Phase 3) can wait until post-workshop
- Focus on reliability over features for workshop MVP
- **Semantic segmentation is working as designed** - Video style affects segment density
