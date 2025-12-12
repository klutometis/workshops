# Little PAIPer - TODO

## Overview

Migrate from static file-based content to database-backed system to support:
1. **Workshop use case** - Users can upload content during live sessions
2. **User authentication** - GitHub OAuth for content ownership
3. **Dynamic content** - No git commits required to add new learning materials

## Technical Stack

- **Database:** Supabase (PostgreSQL + pgvector)
- **Vector Search:** pgvector extension for semantic similarity
- **Auth:** Supabase GitHub OAuth (built-in)
- **Storage:** Supabase Storage for source files (videos, markdown)
- **Processing:** Next.js API routes (with potential background worker later)

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

## Phase 1b: Upload & Processing UI (Next Up)

### Goal
Add UI for workshop attendees to upload YouTube videos and trigger processing.

### Tasks

#### 1. Upload Interface
- [ ] Create `/upload` page with YouTube URL input
- [ ] Add validation (valid YouTube URL, not already processed)
- [ ] Submit creates library record and returns processing ID
- [ ] Redirect to status page after upload

#### 2. Processing Pipeline API
- [ ] `POST /api/libraries/upload` - Accept YouTube URL, create library record
- [ ] `POST /api/libraries/[id]/process` - Trigger pipeline (async if possible)
- [ ] `GET /api/libraries/[id]/status` - Return processing progress
  - Status: pending, downloading, transcribing, extracting_concepts, embedding, complete, error
  - Progress percentage (0-100)
  - ETA if available

#### 3. Status Monitoring
- [ ] Create `/libraries/[id]/status` page
- [ ] Poll API every 2-3 seconds for updates
- [ ] Show progress bar with current stage
- [ ] Display logs/errors if processing fails
- [ ] Auto-redirect to concept graph on completion

#### 4. Pipeline Orchestration
- [ ] Create `scripts/process-youtube-video.ts` - single entry point
- [ ] Sequence: download → transcribe → analyze frames → extract concepts → enrich → embed → import
- [ ] Write status updates to database during processing
- [ ] Handle errors gracefully (store error state, allow retry)
- [ ] Consider timeout limits (long videos may take 30+ minutes)

#### 5. Testing
- [ ] Test upload flow end-to-end
- [ ] Test status polling and progress updates
- [ ] Test error handling (invalid URL, processing failure)
- [ ] Test with short video (<5 min) for fast iteration

---

## Phase 2: Text Sources (Post-Workshop)

### Goal
Support markdown files and Jupyter notebooks as learning content sources.

### Tasks

#### 1. Markdown Pipeline
- [ ] Adapt `chunk-paip.ts` for arbitrary markdown files
- [ ] Create concept extraction for text-only content (no video/frames)
- [ ] Generate embeddings for text chunks
- [ ] Store in same DB schema (type="markdown")

#### 2. Jupyter Notebook Support
- [ ] Parse `.ipynb` format → extract markdown + code cells
- [ ] Treat code cells as examples/demonstrations
- [ ] Link code to concepts (similar to video code extraction)
- [ ] Store in DB with type="notebook"

#### 3. UI Updates
- [ ] Handle text sources in upload form (file upload vs URL)
- [ ] Adapt visualization for text-only content (no timestamps/frames)
- [ ] Show code cells in scratchpad for notebooks
- [ ] Add source type indicator in library list

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

## Open Questions / Decisions Needed

### Processing Architecture
- **Sync vs Async:** Run pipeline in API route (simple, might timeout) or background worker?
- **Recommendation:** Start sync for workshop (simpler), move to async post-workshop

### Storage Strategy
- **Frames/Videos:** Store in Supabase Storage or reference YouTube directly?
- **Recommendation:** Reference YouTube URLs, only store extracted frames in Storage

### Public vs Private Default
- **Question:** Should uploaded libraries be public by default (workshop) or private?
- **Recommendation:** Public for workshop (no auth yet), add privacy controls in Phase 3

### Video Length Limits
- **Question:** Max video duration for workshop uploads? (processing time constraint)
- **Recommendation:** 3 hours max (Karpathy GPT length), warn users about processing time

---

## Current Status

**Phase 1 Complete (2024-12-11):**
- ✅ Database schema with multimodal content support
- ✅ YouTube pipeline (Karpathy GPT video fully processed)
- ✅ Database import script with enriched pedagogical metadata
- ✅ RAG retrieval with pgvector semantic search
- ✅ Socratic dialogue with rich teaching material
- ✅ API routes serving database-backed content
- ✅ Concept graph visualization reading from database
- ✅ Python scratchpad with Pyodide

**Next Phase (1b - Upload UI):**
- 🎯 Build upload form for workshop attendees
- 🎯 Add processing status monitoring
- 🎯 Create orchestration script for end-to-end pipeline
- 🎯 Handle async processing (or document sync processing limits)

**Ready for:**
- Workshop demonstrations with Karpathy GPT video
- Additional video imports using existing pipeline
- Further UI refinement based on user testing

---

## Notes

- Keep existing static files (PAIP, TSP) for reference during migration
- Workshop deadline drives Phase 1 timeline
- Auth (Phase 3) can wait until post-workshop
- Focus on reliability over features for workshop MVP
