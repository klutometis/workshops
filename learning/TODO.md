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

#### 1. Core Processing Functions (Reusable)
- [ ] Create `lib/processing.ts` with core logic:
  - `processYouTubeVideo(url, onProgress?)` 
  - `processMarkdownFile(path, onProgress?)`
  - `processJupyterNotebook(path, onProgress?)`
- [ ] Progress callbacks for stage updates (works for CLI + web)
- [ ] Proper error handling (throw, don't exit)
- [ ] Return structured results (libraryId, stats, etc.)

#### 2. YouTube Video Processing
- [ ] Create `scripts/process-youtube.sh` - CLI entry point
- [ ] Call `processYouTubeVideo()` with URL from args
- [ ] Sequence: download → extract concepts → enrich → embed → import
- [ ] Handle errors gracefully (log + exit code)
- [ ] Test with short video first (<5 min)
- [ ] Verify database import works

#### 3. Markdown File Processing
- [ ] Create `scripts/process-markdown.sh` - CLI entry point
- [ ] Adapt `chunk-paip.ts` for arbitrary markdown files
- [ ] Extract concepts from text-only content (no video/frames)
- [ ] Generate embeddings for text chunks
- [ ] Store in DB with type="markdown"
- [ ] Test with pytudes TSP markdown

#### 4. Jupyter Notebook Processing
- [ ] Create `scripts/process-notebook.sh` - CLI entry point
- [ ] Parse `.ipynb` format → extract markdown + code cells
- [ ] Treat code cells as examples/demonstrations
- [ ] Link code to concepts (similar to video code extraction)
- [ ] Store in DB with type="notebook"
- [ ] Test with sample notebook

#### 5. Testing
- [ ] Test YouTube processing with new video (not Karpathy)
- [ ] Test markdown processing with new file
- [ ] Test notebook processing
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
