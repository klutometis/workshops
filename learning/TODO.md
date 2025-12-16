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
- [x] **Clean URL routing** - Home page shows selector, libraries at `/library/{slug}`
- [x] **Dynamic routes with Next.js 15+** - Proper `params` Promise handling with `React.use()`
- [ ] Create upload form component *(deferred to Phase 1b - workshop upload UI)*
- [ ] Add processing status indicator *(deferred to Phase 1b)*

#### 5. Testing ✅
- [x] **Verified RAG retrieval** - Database embeddings work correctly with semantic search
- [x] **Tested with Karpathy GPT video** - Full end-to-end flow working
- [x] **Validated multimodal content** - Timestamps, code, visuals, key concepts all present
- [x] **Confirmed pedagogical metadata** - Learning objectives (5), mastery indicators (4) flow correctly
- [x] **Performance validated** - Vector similarity search on 859 embeddings performs well

---

## Phase 1a: GitHub Authentication & Personal Libraries ⚡ **IN PROGRESS**

### Goal
Establish GitHub as the identity layer and enable personal libraries from day one.

### Rationale
**GitHub-first architecture:** Every user has a personal library at `/users/{username}`. All content imports (YouTube, notebooks, markdown) are tied to a GitHub identity. This provides:
- ✅ **Built-in identity** - Universal for developers/educators
- ✅ **Clear ownership** - Content belongs to the creator
- ✅ **Natural permissions** - You control your library
- ✅ **Social discovery** - Browse by creator
- ✅ **Private repo access** - Import from private GitHub repositories

### Status: **Authentication Complete** ✅ (2024-12-15)

Authentication is working end-to-end:
- ✅ GitHub OAuth flow functional
- ✅ Users saved to database on sign-in
- ✅ Profile data (name, avatar, login) persisted
- ✅ `last_login_at` updates on subsequent logins
- ✅ GitHub username extracted to session (`jwt` callback)
- ✅ Profile links use unique username (`/users/klutometis`)
- ✅ Avatar images configured in Next.js (`avatars.githubusercontent.com`)
- ✅ Tested with user `klutometis` successfully

### Tasks

#### 1. Setup GitHub OAuth ✅ **COMPLETE** (2024-12-15)
- [x] Install NextAuth.js: `npm install next-auth` (was already v4.24.13)
- [x] Configure GitHub OAuth provider (`lib/auth.ts`)
- [x] Register OAuth app at github.com/settings/developers
- [x] Store credentials in environment (loaded via `scripts/dev.sh`)
- [x] Create NextAuth API routes (`app/api/auth/[...nextauth]/route.ts`)
- [x] Add `jwt` callback to extract GitHub username from profile
- [x] Add `session` callback to include username in session
- [x] Configure Next.js image domains for GitHub avatars
- [x] Test OAuth flow and verify database persistence

#### 2. Database Schema Updates ✅ **COMPLETE** (Already existed)
- [x] `users` table already created in schema migrations
- [ ] Add `user_id` foreign key to `libraries` table:
  ```sql
  ALTER TABLE libraries 
    ADD COLUMN user_id INTEGER REFERENCES users(id),
    ADD COLUMN slug TEXT,
    ADD CONSTRAINT unique_user_slug UNIQUE (user_id, slug);
  ```
- [ ] Add index: `CREATE INDEX idx_libraries_user_id ON libraries(user_id);`

#### 3. Authentication UI Components ✅ **COMPLETE** (2024-12-15)
- [x] Create `app/api/auth/[...nextauth]/route.ts` (NextAuth handler)
- [x] Create `AuthButton` component with sign-in/user menu
- [x] Display GitHub avatar with proper image configuration
- [x] Profile link to `/users/{username}` (unique GitHub login)
- [x] Sign out functionality
- [x] Add auth UI to app layout header
- [x] Integrate `SessionProvider` in layout
- [ ] Protected route wrapper for `/publish` (deferred to Phase 1b)

**Note:** Currently using NextAuth's default sign-in page at `/api/auth/signin`. Works well for MVP.

#### 4. Personal Library Pages 🎯 **HIGH PRIORITY**
- [ ] Create `/users/[username]/page.tsx` - List user's public libraries
- [ ] Create `/users/[username]/[library]/page.tsx` - Individual library view
- [ ] Migrate existing library routes to new URL structure:
  - `/library/[slug]` → `/users/system/[slug]` (for pre-auth imports)
  - Or: Assign to admin user as fallback
- [ ] Add "View Profile" link to library headers
- [ ] Display author info (avatar, name, GitHub link)

#### 5. Home Page Updates 🎯 **HIGH PRIORITY**
- [ ] Show "Sign in with GitHub to publish" for logged-out users
- [ ] Show "Publish new content" button for logged-in users
- [ ] "Recently Published" feed across all users
- [ ] Featured libraries (curated by admin)
- [ ] Browse by creator

#### 6. Testing
- [x] Test OAuth flow (sign in → callback → session) ✅
- [x] Verify user record created on first login ✅
  - User `klutometis` (Peter Danenberg) saved successfully
  - Timestamp: 2025-12-15 23:25:43.369512+00
- [x] Verify username extraction to session (requires re-login after jwt callback added) ✅
- [x] Test profile link uses GitHub username (`/users/klutometis`) ✅
- [x] Confirm avatar images load correctly ✅
- [x] Test sign out and re-sign in flow ✅
- [ ] Test personal library page displays correctly (not yet implemented)
- [ ] Confirm protected routes redirect to sign-in (not yet implemented)

### Success Criteria
- ✅ Users can sign in with GitHub
- ✅ Profile links use unique GitHub usernames
- ✅ Avatar images load from GitHub CDN
- ✅ Session includes username for personalization
- 🚧 Personal library pages work: `/users/klutometis` (next step)
- 🚧 All imports are tied to a user (Phase 1b)
- 🚧 Only authenticated users can publish (Phase 1b)

---

## Phase 1b: Import/Publish Pipeline (requires Phase 1a)

### Goal
Build the `/publish` route and backend pipeline to process content from multiple sources.

### Architecture
**GitHub-authenticated publishing:** All imports require sign-in and create libraries owned by that user.

```
Sign in with GitHub
    ↓
Go to /publish
    ↓
Paste URL: GitHub .ipynb, YouTube, .md, etc.
    ↓
Pipeline processes content
    ↓
Published to /users/{username}/{slug}
```

### Tasks

#### 1. Publish Route & UI ⚡ **IMMEDIATE** (requires auth from Phase 1a)
- [ ] Create `/publish/page.tsx` - Main import interface
- [ ] Require authentication (redirect if not logged in)
- [ ] Input: URL field (auto-detect source type)
- [ ] Support types:
  - GitHub: `github.com/{owner}/{repo}/blob/{branch}/{path}.ipynb`
  - YouTube: `youtube.com/watch?v={id}`
  - Public URLs: `example.com/notebook.ipynb`
- [ ] Show source type detection
- [ ] Add "Private GitHub repo" checkbox (uses OAuth token)
- [ ] Display processing progress UI
- [ ] Redirect to `/users/{username}/{slug}` on success

#### 2. Publish API Endpoint ⚡ **IMMEDIATE**
- [ ] Create `/api/publish/route.ts`
- [ ] Extract `user_id` from session (NextAuth)
- [ ] Parse and validate source URL
- [ ] Route to appropriate processor:
  - GitHub → `processJupyterNotebook()` or `processMarkdownFile()`
  - YouTube → `processYouTubeVideo()`
  - Generic URL → download and detect type
- [ ] Generate unique slug (title-based, handle collisions)
- [ ] Store library with `user_id` foreign key
- [ ] Return: `{ libraryId, slug, url: '/users/{username}/{slug}' }`

#### 3. YouTube Video Processing ✅ **COMPLETE** (2024-12-12)
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

#### 4. Jupyter Notebook Processing ✅ **COMPLETE** (2024-12-15)

**Architecture Decision:** Notebooks are a **preprocessing detail**, not a frontend concern.

**Import Flow:**
```bash
npx tsx scripts/process-notebook.ts https://github.com/user/repo/blob/main/notebook.ipynb
```

**What happens during import:**
1. **Download:** Fetch `.ipynb` from GitHub/URL → `temp/notebooks/`
2. **Convert:** `uvx jupyter nbconvert` → `raw.md` (with inline images for display)
3. **Clean:** Post-process → `cleaned.md` (strip images for LLM segmentation)
4. **Store raw:** Put `raw.md` in database `markdown_content` field
5. **Segment clean:** Extract concepts, chunk, embed using `cleaned.md`
6. **Set type:** `type='markdown'` in database (frontend treats it as regular markdown)

**Frontend sees:** Regular markdown library with inline images working perfectly via `MarkdownViewer`

**Key Insight:** 
- ✅ Notebooks are just markdown with inline images
- ✅ Processing pipeline handles conversion (the only place that knows about .ipynb)
- ✅ No special cases in frontend/API/database queries
- ✅ MarkdownViewer already handles inline images correctly

**Completed Tasks:**

**Step 1: Preprocessing Integration** ✅
- [x] **Two-markdown approach** implemented in `lib/processing.ts`:
  - `convertNotebookToMarkdown()` returns both raw and cleaned versions
  - Raw saved to `{slug}-raw.md` (with images for display)
  - Cleaned saved to `{slug}-cleaned.md` (no images for LLM)
- [x] **Pipeline uses cleaned version** for all segmentation
- [x] **Database stores raw version** for frontend rendering
- [x] **Path handling fixed** - Uses parent directory, not filename-derived paths
- [x] **Title extraction improved** - Uses first `# Header` from markdown, not filename

**Step 2: Path Bug Fixes** ✅
- [x] Fixed `import-to-db.ts` workDir derivation (was using filename, now uses dirname)
- [x] Eliminated `-raw` suffix contamination in paths
- [x] Artifacts now found in correct location

**Step 3: Title Extraction** ✅
- [x] Added `extractMarkdownTitle()` helper function
- [x] Priority: AI metadata > first `# Header` > filename
- [x] Eliminates meaningless titles like "PYTHONINTROCH1"

**Step 4: Testing Status**
- ✅ Download and conversion pipeline works end-to-end
- ✅ Path bug fixed - artifacts found in correct directory
- ✅ Title extraction working with markdown headers
- 🚧 Need to test full pipeline: extract → chunk → enrich → map → embed → import

**Benefits:**
- ✅ **Zero frontend complexity** - No special notebook handling
- ✅ **Reuses all existing infrastructure** - Markdown pipeline, viewer, RAG
- ✅ **Inline images preserved** - Raw markdown has them, viewer displays them
- ✅ **Clean segmentation** - LLM processes markdown without image bloat
- ✅ **Robust path handling** - No filename parsing, uses directory structure
- ✅ **Meaningful titles** - Extracts from markdown headers, not filenames

**Three Content Types, One Database:**
```
YouTube:  URL → download video → transcript → frames → concepts → segments → DB
Markdown: URL → download .md → concepts → chunks → segments → DB
Notebook: URL → download .ipynb → convert (raw + clean) → [markdown workflow] → DB
```

The notebook type is purely an **import variant**, not a distinct content type.

**Next Steps:**
1. Test full pipeline end-to-end with a real notebook
2. Verify inline images display correctly in MarkdownViewer
3. Complete remaining markdown pipeline stages (enrich, map, embed)

#### 5. API Optimizations ✅ **COMPLETE** (2024-12-12)
- [x] **Fixed markdown content duplication** in `/api/socratic-dialogue`
- [x] Moved `markdown_content` from per-source to response level
- [x] Reduced response size by 80-90% for multi-source queries
- [x] Fixed scope error with `library` variable
- [x] Only fetch library when sources are present (optimization)

**Impact:** 5 sources with 2MB markdown went from 10MB response to 2MB response.

#### 7. Testing (End-to-End with Auth)
- [ ] Sign in as test user
- [ ] Import public Jupyter notebook from GitHub → appears at `/users/testuser/notebook-name`
- [ ] Import YouTube video → appears at `/users/testuser/video-title`
- [ ] Import markdown file → appears at `/users/testuser/doc-title`
- [ ] Verify all appear in personal library list
- [ ] Confirm other users can view (if public)
- [ ] Test private GitHub repo import (requires OAuth token)
- [ ] Verify Socratic dialogue works with all types


## Phase 2: Interactive Python Scratchpad (Workshop Priority)

### Goal
Improve the Python scratchpad UX for learners working through exercises and examples.

### Current Issues (Identified 2024-12-12)

1. **Libraries must be manually installed** - Students must run `await micropip.install('numpy')` before using numpy, matplotlib, etc.
2. **Code editor not scrollable** - Large code blocks make output disappear off screen
3. **Output not scrollable** - Long output (prints, dataframes) truncated
4. **Matplotlib plots on wrong canvas** - Plots appear behind the lesson instead of in the scratchpad

### Tasks

#### 1. Make Code & Output Scrollable ⚡ **HIGH PRIORITY**
- [ ] Add fixed height to code editor (e.g., 400px) with `overflow-y: auto`
- [ ] Add max-height to output section (e.g., 300px) with `overflow-y: auto`
- [ ] Test with long code examples (50+ lines)
- [ ] Test with large output (e.g., printing arrays, dataframes)
- [ ] Add scroll indicators (fade/shadow) when content overflows

#### 2. Preload Common Libraries ⚡ **HIGH PRIORITY**
- [ ] Initialize Pyodide with common packages at app startup:
  - `numpy` - Array operations, math
  - `matplotlib` - Plotting and visualization
  - `pandas` - Data analysis (optional, larger size)
  - `scipy` - Scientific computing (optional)
- [ ] Show loading indicator: "Loading Python environment..."
- [ ] Cache Pyodide in service worker for faster subsequent loads
- [ ] Document which libraries are preloaded in scratchpad help text

#### 3. Tab-Based Output Layout 🎯 **MEDIUM PRIORITY**
- [ ] Add tabs to output section:
  - **📝 Console** - Text output (print statements, errors)
  - **📊 Graphics** - Matplotlib canvas for plots
  - **📋 Variables** (future) - Inspect variables in scope
- [ ] Auto-switch to Graphics tab when plot is created
- [ ] Preserve output across tab switches
- [ ] Add "Clear" button per tab

#### 4. Matplotlib Integration 🎯 **MEDIUM PRIORITY**
- [ ] Configure matplotlib to use Pyodide canvas backend:
  ```python
  import matplotlib
  matplotlib.use('module://matplotlib_pyodide.html5_canvas_backend')
  ```
- [ ] Create dedicated `<canvas>` element in Graphics tab
- [ ] Render plots to scratchpad canvas (not behind lesson)
- [ ] Support multiple figures (scroll through plots)
- [ ] Add "Download PNG" button for plots
- [ ] Clear canvas on code reset

#### 5. Enhanced Editor Features 📝 **LOW PRIORITY**
- [ ] Syntax highlighting for Python (use Monaco or CodeMirror)
- [ ] Show inline errors (syntax, runtime exceptions)
- [ ] Line numbers in code editor
- [ ] Keyboard shortcuts (Ctrl+Enter to run)
- [ ] Code templates dropdown (starter examples)
- [ ] Collapsible code/output sections

#### 6. Error Handling Improvements 📝 **LOW PRIORITY**
- [ ] Format Python tracebacks more readably
- [ ] Link to line numbers in error messages
- [ ] Distinguish syntax errors vs runtime errors
- [ ] Add "Debug tips" for common errors
- [ ] Syntax validation before execution

### Proposed Layout

```
┌─────────────────────────────────────┐
│  Code Editor (scrollable, 400px)    │
│  import numpy as np                 │
│  import matplotlib.pyplot as plt    │
│  ...                                │
│  [▶ Run] [↻ Reset] [? Help]        │
├─────────────────────────────────────┤
│  📝 Console | 📊 Graphics           │ ← Tabs
├─────────────────────────────────────┤
│  Output area (scrollable, 300px)    │
│  4                                  │
│  [2, 4, 6, 8]                      │
│  ...                                │
│                    [Clear] [Copy]   │
└─────────────────────────────────────┘
```

### Success Metrics
- Students can run numpy/matplotlib examples without manual setup
- Code and output remain visible for 50+ line programs
- Plots appear in the scratchpad, not behind UI
- Error messages are clear and actionable

---

## Phase 3: Content Management & Collaboration (Future)

### Goal
Enable users to manage, update, and collaborate on their published content.

### Tasks

#### 1. Library Management
- [ ] Edit library metadata (title, description)
- [ ] Delete library (soft delete, preserve concept graph)
- [ ] Update from source (re-import to sync with GitHub)
- [ ] Visibility toggle (public/private/unlisted)

#### 2. Row Level Security (RLS)
- [ ] Implement Supabase RLS policies:
  - All users can read public libraries
  - Users can CRUD their own libraries
  - Admins can moderate/feature content
- [ ] Add `is_admin` flag to users table
- [ ] Create admin dashboard route

#### 3. Collaboration Features
- [ ] "Fork" library (duplicate to your account)
- [ ] Share unlisted libraries via secret link
- [ ] Comment on concepts (future)
- [ ] Suggest improvements (future)

#### 4. Discovery & Curation
- [ ] "Featured" tag (admin-curated)
- [ ] "Recently published" feed
- [ ] Search libraries by title/author
- [ ] Filter by source type (YouTube, notebook, markdown)
- [ ] "Trending" based on learner activity

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

## Implementation Order Summary

**Week 1: Foundation**
1. ✅ Database with pgvector (COMPLETE)
2. ✅ CLI processing pipelines (COMPLETE)
3. ⚡ GitHub OAuth setup (Phase 1a)
4. ⚡ Personal library pages (Phase 1a)

**Week 2: Publishing**
5. 🎯 `/publish` route with auth gate (Phase 1b)
6. 🎯 Import pipeline with user ownership (Phase 1b)
7. 🎯 End-to-end testing with real users (Phase 1b)

**Week 3: Polish**
8. 📝 Python scratchpad improvements (Phase 2)
9. 🎨 UI refinements and mobile responsiveness
10. 📊 Analytics and monitoring setup

**Future:**
- Content management features (edit, delete, fork)
- Advanced discovery and curation
- Production scaling and optimization

## Architecture Decisions

### ✅ **GitHub as Identity Layer**
- **Decision:** Require GitHub sign-in for all publishing
- **Rationale:** Universal identity for developers, enables personal libraries, natural permissions model
- **Impact:** Simpler than optional auth, clearer ownership model

### ✅ **Personal Libraries First**
- **Decision:** All content lives at `/users/{username}/{slug}`
- **Rationale:** Aligns with GitHub Pages mental model, enables social discovery
- **Impact:** Front page becomes curated feed across creators

### ✅ **Public by Default**
- **Decision:** Imported libraries are public unless marked private
- **Rationale:** Educational content benefits from discoverability
- **Impact:** Privacy toggle added later as needed

### ✅ **Source URLs as Provenance**
- **Decision:** Always store original GitHub/YouTube URL
- **Rationale:** Enables re-import to sync, proper attribution, version tracking
- **Impact:** Database stores source metadata for all libraries

## Open Questions

- **Async processing:** Use background jobs (BullMQ) for imports >30 seconds?
- **Slug collision handling:** Auto-increment (tsp, tsp-2) or force unique titles?
- **Video length limits:** Cap at 3 hours to manage costs?
- **Frame storage:** Supabase Storage vs. reference YouTube CDN?

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
