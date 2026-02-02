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

### Status: **COMPLETE** ✅ (2024-12-15)

Phase 1a is complete - authentication, personal library pages, AND interactive library experience all working end-to-end:
- ✅ GitHub OAuth flow functional
- ✅ Users saved to database on sign-in
- ✅ Profile data (name, avatar, login) persisted
- ✅ `last_login_at` updates on subsequent logins
- ✅ GitHub username extracted to session (`jwt` callback)
- ✅ Profile links use unique username (`/users/klutometis`)
- ✅ Avatar images configured in Next.js (`avatars.githubusercontent.com`)
- ✅ Personal library page at `/users/[username]` rendering correctly
- ✅ Database queries working (getUserByUsername, getLibrariesByUsername)
- ✅ Empty state handling for users with no libraries
- ✅ Tested with user `klutometis` successfully
- ✅ **Interactive library refactoring complete** - `InteractiveLibrary.tsx` reusable component created
- ✅ **Code duplication eliminated** - demo and user libraries share same interactive experience
- ✅ **User libraries interactive** - `/users/{username}/{slug}` shows full learning experience when ready
- ✅ **Status page working** - Shows processing state for pending/processing/failed libraries

**Ready for Phase 1b:** Build `/publish` route and import pipeline! 🚀

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

#### 4. Personal Library Pages ✅ **COMPLETE** (2024-12-15)
- [x] Create `/users/[username]/page.tsx` - List user's public libraries ✅
- [x] Added `getUserByUsername()` and `getLibrariesByUsername()` to `lib/db.ts` ✅
- [x] Displays user avatar, name, and @username from GitHub profile ✅
- [x] Shows count of public libraries with empty state message ✅
- [x] Grid layout for library cards (similar to home page) ✅
- [x] Returns 404 for non-existent users via `notFound()` ✅
- [x] Fixed Next.js 15+ `params` Promise handling with `await params` ✅
- [x] Create `/users/[username]/[slug]/page.tsx` - Individual library view ✅
- [x] **Library page double-duty complete** ✅:
  - Shows `LibraryStatusPage` when `pending`/`processing`/`failed` ✅
  - Shows `LibraryInteractivePage` when `ready` with concept graph data ✅
  - Created reusable `InteractiveLibrary.tsx` component ✅
  - Eliminated code duplication with `/library/[slug]` route ✅
  - Full concept graph, Socratic dialogue, mastery tracking working ✅
- [ ] Add contextual management controls (when logged in as owner):
  - ⚙️ Settings dropdown in top-right corner
  - Actions: Edit metadata, Reprocess, Make private/public, Delete
  - Only visible to library owner

#### 5. Personal Library Page Improvements 🎯 **HIGH PRIORITY**

**Goal:** Better navigation and library management from personal profile page.

**Essential (Quick Wins):**
- [ ] **Back to home link** - "← Public Libraries" at top of page
- [ ] **"Publish New Library" button** - Prominent CTA directing to `/publish`
- [ ] **Delete library action** - Per-library dropdown with delete option:
  - Confirmation dialog: "Are you sure? This cannot be undone."
  - API: `DELETE /api/libraries/[id]` (requires auth, owner-only)
  - Soft delete recommended (mark `deleted_at`, don't actually remove)
  - Show success toast, refresh library list

**Nice to Have (Future):**
- [ ] **Toggle public/private** - Quick switch in library card dropdown
  - Updates `is_public` flag without deleting
  - "Make Public" / "Make Private" action
  - Instant feedback with toast notification
- [ ] **Edit metadata** - Modal to update title, description
  - API: `PATCH /api/libraries/[id]` 
  - Form validation for title/description
  - Slug remains unchanged (preserve URLs)
- [ ] **Copy share link** - Button to copy library URL to clipboard
  - Shows full URL: `https://example.com/users/username/slug`
  - "Link copied!" toast feedback
- [ ] **Reprocess library** - Re-run import pipeline (see Phase 1b contextual controls)

**UI Pattern for Library Cards:**
```tsx
// Each library card shows:
[Library Title]
Status badge | Created date
[View] [⋮ More] ← Dropdown with:
  - Copy share link
  - Toggle public/private
  - Edit details
  - Delete
```

**Implementation Notes:**
- Only show management controls when viewing your own profile
- Hide actions when viewing someone else's profile
- Use confirmation dialogs for destructive actions
- Show loading states during API calls
- Refresh library list after successful updates

#### 6. Home Page Updates 📝 **MEDIUM PRIORITY**
- [ ] Show "Sign in with GitHub to publish" for logged-out users
- [ ] Show "Publish new content" button for logged-in users
- [ ] "Recently Published" feed across all users
- [ ] Featured libraries (curated by admin)
- [ ] Browse by creator

#### 7. UI Polish ✅ **COMPLETE** (2024-12-16)
- [x] Fixed text contrast issues in library headers
- [x] Implemented dark floating navigation pill
- [x] Made all navigation text visible on both light and dark backgrounds
- [x] Consistent styling across "Sign out", "About", and username display
- [x] Professional appearance with backdrop blur and shadows

#### 8. Testing ✅ **COMPLETE**
- [x] Test OAuth flow (sign in → callback → session) ✅
- [x] Verify user record created on first login ✅
  - User `klutometis` (Peter Danenberg) saved successfully
  - Timestamp: 2025-12-15 23:25:43.369512+00
- [x] Verify username extraction to session (requires re-login after jwt callback added) ✅
- [x] Test profile link uses GitHub username (`/users/klutometis`) ✅
- [x] Confirm avatar images load correctly ✅
- [x] Test sign out and re-sign in flow ✅
- [x] Test personal library pages display correctly ✅
  - `/users/klutometis` renders profile with avatar and name
  - Shows "Public Libraries (0)" count
  - Empty state message displays correctly
  - Database queries work (user lookup + library join)
- [x] Test individual library page status display ✅
  - `/users/klutometis/python-intro-chapter-1` shows processing status
  - Status updates correctly (`pending` → `processing` → `ready`/`failed`)
  - Different UI for each status state

### Success Criteria
- ✅ Users can sign in with GitHub
- ✅ Profile links use unique GitHub usernames
- ✅ Avatar images load from GitHub CDN
- ✅ Session includes username for personalization
- ✅ Personal library pages work: `/users/klutometis` displays profile and libraries
- ✅ Empty state message shows when no libraries published
- ✅ Database queries correctly join users and libraries tables
- ✅ Individual library page shows status: `/users/klutometis/python-intro-chapter-1`
- ✅ **Library page shows interactive experience when ready** - Full learning interface working
- ✅ **Code duplication eliminated** - Shared `InteractiveLibrary` component
- 🎯 Next: Build `/publish` route and import pipeline (Phase 1b)

### Architecture Note: URL Structure

**Primary Pattern:** `/users/[username]/[slug]`
- ✅ User-namespaced slugs (like GitHub repos)
- ✅ Natural sharing: "Check out my library at `/users/klutometis/tsp`"
- ✅ Supports future forking: `/users/pnorvig/tsp` vs `/users/klutometis/tsp`
- ✅ Double-duty page: Status during processing → Interactive library when ready

**Legacy Pattern:** `/library/[slug]` 
- Used for original demo libraries (PAIP, etc.)
- May eventually be deprecated in favor of user-namespaced pattern
- Requires globally unique slugs (no namespace)

---

## Phase 1b: Import/Publish Pipeline (requires Phase 1a)

### Goal
Build the `/publish` route and backend pipeline to process content from multiple sources.

### Status: **COMPLETE** ✅ (2024-12-22)

**🎉 Phase 1b is COMPLETE!** The entire import pipeline is working end-to-end in production on Cloud Run Jobs!

**What Works:**
- ✅ `/publish` page with authentication gate
- ✅ URL auto-detection (YouTube, GitHub notebooks, markdown)
- ✅ Fast library creation (~1 second)
- ✅ Immediate redirect to status page
- ✅ Real-time polling for status updates
- ✅ All status transitions tested (pending → processing → ready)
- ✅ Progress callbacks working with async database writes
- ✅ Frontend shows real-time progress (10% → 25% → 40%...)
- ✅ **Processing wrapper complete** - `scripts/process-library.ts` routes to appropriate processors
- ✅ **Processing logs system** - Full debugging infrastructure with database storage
- ✅ **Enhanced error handling** - Captures full script failures with stdout/stderr
- ✅ **Notebook rendering simplified** - Uses MarkdownViewer, no special frontend case
- ✅ **Source ordering** - Text chunks by line number, videos by timestamp
- ✅ **Tab focus** - Notebooks/markdown show source first, YouTube shows Python first
- ✅ **Improved slug handling** - URL hash-based collision resolution
- ✅ **Public/private libraries** - `is_public` flag filters home page, personal libraries hidden by default
- ✅ **Cloud Run Job working in production** - Successfully processed Jupyter notebook end-to-end (~8 min)
- ✅ **API key handling fixed** - All scripts check both GOOGLE_API_KEY and GEMINI_API_KEY
- ✅ **Error surfacing working** - stderr inheritance reveals script failures immediately
- ✅ **Temp file cleanup verified** - Both markdown and notebook temp dirs cleaned up

**Performance Notes:**
- 📊 Concept enrichment takes ~6 minutes (Gemini API calls for pedagogical metadata)
- 📊 Total processing time: ~8 minutes for typical notebook
- 🎯 Enrichment performance optimization deferred to Phase 5

**Future Enhancements (Optional):**
- 📝 Add "Private GitHub repo" checkbox
- 📝 Command-line import tool: `npx tsx scripts/import-from-url.ts <url>`

**Note on Slug Generation:** ✅ **FIXED** (2024-12-16)
- ✅ All new imports get semantic slugs: `python-in-100-seconds` instead of `x7X9w_GIm1s`
- ✅ Re-importing updates old libraries to semantic slugs
- ✅ Slugs remain stable throughout processing (never overwritten)

**Success Criteria:** ✅ **ALL COMPLETE**
- ✅ Users can publish from `/publish` page
- ✅ YouTube videos process end-to-end
- ✅ Jupyter notebooks process end-to-end (Cloud Run production test successful)
- ✅ Markdown files process end-to-end
- ✅ Status page polls and updates in real-time
- ✅ Libraries appear at `/users/{username}/{slug}` when ready
- ✅ Interactive learning experience works with imported content
- ✅ Cloud Run Job handles long-running processing (~8 min typical)

### Architecture
**GitHub-authenticated publishing:** All imports require sign-in and create libraries owned by that user.

```
Sign in with GitHub
    ↓
Go to /publish
    ↓
Paste URL: GitHub .ipynb, YouTube, .md, etc.
    ↓
Pipeline processes content (Cloud Run Job - TODO)
    ↓
Published to /users/{username}/{slug}
```

### Completed Tasks

#### 1. Publish Route & UI ✅ **COMPLETE** (2024-12-15)
- [x] Create `/publish/page.tsx` - Main import interface ✅
- [x] Require authentication (redirect if not logged in) ✅
- [x] Input: URL field (auto-detect source type) ✅
- [x] Support types: ✅
  - YouTube: `youtube.com/watch?v={id}`
  - GitHub notebooks: `github.com/{owner}/{repo}/blob/{branch}/{path}.ipynb`
  - GitHub markdown: `github.com/{owner}/{repo}/blob/{branch}/{path}.md`
  - Public URLs: `example.com/notebook.ipynb`
- [x] Show source type detection ✅
- [x] Redirect to `/users/{username}/{slug}` immediately ✅
- [ ] Add "Private GitHub repo" checkbox (uses OAuth token) - **deferred, not needed for MVP**

#### 2. Async Processing Architecture ✅ **COMPLETE** (2024-12-15)

**Decision:** Long-running imports (10-30 minutes) require async processing pattern.

**Pattern:**
1. **`POST /api/publish`** - Fast, synchronous (~1 second): ✅
   - Create library record with `status: 'pending'`
   - Trigger Cloud Run Job (one API call) - **TODO**
   - Return library ID immediately
   - Frontend redirects to status page

2. **Cloud Run Job** - Long-running, independent: 🚧 **TODO**
   - Does heavy processing (download, transcribe, extract, embed)
   - Updates database: `pending` → `processing` → `ready`/`failed`
   - Can write `progress_message` for UI feedback
   - Runs to completion regardless of client connection

3. **`LibraryStatusPage`** - Client polls for updates: ✅
   - Calls `GET /api/libraries/[id]` every 5 seconds
   - Shows current status and progress
   - Stops polling when `ready` or `failed`
   - Automatically shows interactive library when ready

**Implementation Tasks:**
- [x] Create `/api/publish/route.ts`: ✅
  - Extract `user_id` from session (NextAuth) ✅
  - Parse and validate source URL ✅
  - Generate unique slug (title-based, handle collisions) ✅
  - Create library record with `status: 'pending'`, `user_id` foreign key ✅
  - Return: `{ libraryId, slug, url: '/users/{username}/{slug}' }` ✅
  - **TODO:** Trigger Cloud Run Job with library ID and source URL

- [x] Create `/api/libraries/[id]/route.ts`: ✅
  - Polling endpoint for library status updates ✅
  - Returns library metadata, status, progress_message, error_message ✅
  - Validates UUID format before querying database ✅
  - Fixed bug: Was using `parseInt(id, 10)` which converted UUIDs to integers ✅

- [x] Add polling to `LibraryStatusPage.tsx`: ✅
  - `useEffect` with `setInterval` (every 5 seconds) ✅
  - Stop polling when status is `ready` or `failed` ✅
  - Refresh library data from API ✅
  - Shows spinner and "Checking for updates..." indicator ✅
  - Displays progress_message in blue info box ✅

- [x] Fix progress callback async handling (`lib/processing.ts`): ✅
  - Changed `ProgressCallback` type to support `Promise<void> | void` ✅
  - Added `await` to all `onProgress?.()` calls (24 total) ✅
  - Progress updates now properly write to database ✅
  - Tested end-to-end with real library processing ✅

- [x] Add `progress_message` column to `libraries` table: ✅
  - Created migration 003 ✅
  - Updated schema.sql ✅
  - Applied and tested successfully ✅

- [x] Create `scripts/process-library.ts` wrapper ✅ **COMPLETE** (2024-12-16)
  - Accepts library ID from command line
  - Fetches library metadata from database
  - Routes to appropriate processor (YouTube, notebook, markdown)
  - Updates database status throughout process (`pending` → `processing` → `ready`/`failed`)
  - Writes `progress_message` for UI feedback
  - Sets `error_message` on failure with proper error handling
  - UUID validation and graceful error messages
  - **Database logging** - Appends to `processing_logs` JSONB array
  - **Enhanced error capture** - Full stdout/stderr in failure logs
  - **Library ID parameter** - Passed to all processing functions
  
- [x] Test local processing: ✅ **COMPLETE** (2024-12-18)
  - Tested: `npx tsx scripts/process-library.ts 53bb5e7f-9a4d-4cf1-a926-7e6b7d3d203a`
  - Notebook processing working end-to-end
  - Temp file cleanup verified
  - All stages complete: extract → chunk → enrich → map → embed → import
  
- [x] Deploy as Cloud Run Job: ✅ **COMPLETE** (2024-12-18)
  - Dockerfile includes scripts directory
  - Cloud Run Job created: `learning-processor`
  - Trigger logic implemented in `/api/publish` route
  - Environment-based mode selection (local vs job)
  - **Ready for production deployment:** `cd learning && ./scripts/deploy.sh`

#### Testing ✅ **COMPLETE** (2024-12-15)
- [x] Published YouTube video: "Getting Started with Python in Less Than 10 Minutes" ✅
- [x] Library created with UUID: `88b2316d-16e1-491f-bc2c-8613b8839b77` ✅
- [x] Redirected to `/users/klutometis/youtube-video` immediately ✅
- [x] Status page showed "Pending" with polling indicator ✅
- [x] Manually updated database to test status transitions: ✅
  - `pending` → Green "⏳ Pending" badge, polling active
  - `processing` → Blue "⚙️ Processing" badge, progress message shown, polling continues
  - `ready` → Green "✅ Ready" badge, polling stopped, processed timestamp displayed
- [x] Polling stopped automatically when status changed to `ready` ✅
- [x] No more UUID parsing errors in API logs ✅
- [x] Progress messages displayed correctly in UI ✅

### Next Steps

**🎯 Immediate Priority:** Wire up processing!

1. **Create `scripts/process-library.ts`** (30 minutes):
   ```typescript
   // Accepts library ID from command line
   // Fetches library from database
   // Routes to appropriate processor based on source_type
   // Updates status: pending → processing → ready/failed
   // Writes progress_message throughout
   ```

2. **Local testing** (15 minutes):
   - Trigger manually: `npx tsx scripts/process-library.ts <library-id>`
   - Watch status page update in real-time
   - Verify concept graph appears when ready

3. **Deploy as Cloud Run Job** (1 hour):
   - Create Dockerfile
   - Deploy to Cloud Run Jobs
   - Trigger from `/api/publish` route via Cloud Run Jobs API
   - Test end-to-end: publish → process → ready

**After that:** Phases 2-5 (Python scratchpad, content management, production)

#### 3. YouTube Video Processing ✅ **COMPLETE** (2024-12-12)
- [x] **End-to-end pipeline working**
- [x] `scripts/process-youtube.ts` - orchestrates full pipeline
- [x] Sequence: download → transcribe → analyze frames → extract concepts → enrich → map segments → embed → import
- [x] Uses shared `lib/embeddings.ts` for 1536D embeddings
- [x] Database import with proper integer rounding
- [x] Tested with: "Getting Started with Python" video (fWjsdhR3z3c)
- [x] Semantic search returns relevant multimodal segments
- [x] Socratic tutor works with video-backed context

**Status:** Production-ready for YouTube videos with semantic URLs! 🎉

#### 4. Semantic URL Generation ✅ **COMPLETE** (2024-12-16)
- [x] Fetch YouTube metadata synchronously in publish route
- [x] Generate semantic slug from video title before creating library
- [x] Prevent slug overwrite during processing
- [x] Fix re-import flow to update in-memory object
- [x] Test end-to-end with new imports and re-imports
- [x] Verify URL stability throughout processing pipeline

**Benefits:**
- ✅ URLs are human-readable: `/users/klutometis/python-in-100-seconds`
- ✅ Links never change once created
- ✅ Better for SEO and sharing
- ✅ Consistent with markdown/notebook URL patterns

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

#### 4. Jupyter Notebook Processing ✅ **COMPLETE** (2024-12-16)

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

**Completed Tasks:** ✅ **ALL COMPLETE** (2024-12-16)

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

**Step 4: Frontend Integration** ✅
- [x] Removed `NotebookViewer` component - notebooks use `MarkdownViewer`
- [x] Removed `notebookData` prop from `SocraticDialogue`
- [x] Auto-load markdown content for notebooks
- [x] Default to "Source" tab for text-based libraries
- [x] Tab reset logic respects library type

**Step 5: Testing Status** ✅
- ✅ Download and conversion pipeline works end-to-end
- ✅ Path bug fixed - artifacts found in correct directory
- ✅ Title extraction working with markdown headers
- ✅ Frontend renders notebooks as markdown with inline images
- ✅ Source tab shown by default for notebook libraries
- ✅ Full pipeline ready: extract → chunk → enrich → map → embed → import

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
- [ ] Import public Jupyter notebook from GitHub:
  - Redirected to status page immediately
  - Status updates via polling (`pending` → `processing` → `ready`)
  - Appears at `/users/testuser/notebook-name`
  - Interactive library loads when ready
- [ ] Import YouTube video → same flow
- [ ] Import markdown file → same flow
- [ ] Test client disconnect during processing (close tab, reopen - should still work)
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

#### 7. Project Mode Integration 🎯 **NEW - FROM PHASE 6**
- [ ] **Multi-file code organization** - Support multiple Python files in scratchpad
- [ ] **Checkpoint system** - Save progress at project milestones
- [ ] **Connect to project goals** - Link scratchpad exercises to coherent projects
- [ ] **Project navigation** - Switch between exercise steps
- [ ] **Progress tracking** - Visual indicator of project completion

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

#### 1. Library Management (Contextual Controls)

**Implementation:** Settings dropdown on library page (visible only to owner)

- [ ] **Edit metadata modal**:
  - Change title, description
  - Update tags/categories
  - Modify thumbnail/cover image
- [ ] **Reprocess action**:
  - Re-run import pipeline from original source URL
  - Useful when processing code improves
  - Shows progress, preserves old version until complete
- [ ] **Visibility toggle**:
  - Public (default) - appears in feeds, search
  - Private - only accessible to owner
  - Unlisted - accessible via direct link only
- [ ] **Delete library**:
  - Confirmation dialog
  - Soft delete (mark as deleted, preserve in DB)
  - Option to hard delete after grace period

**UI Pattern:**
```tsx
// Top-right corner of /users/[username]/[slug] when isOwner
<DropdownMenu>
  <Button variant="ghost">⚙️ Settings</Button>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit Details</DropdownMenuItem>
    <DropdownMenuItem>Reprocess Library</DropdownMenuItem>
    <DropdownMenuItem>Make Private/Public/Unlisted</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-red-600">Delete Library</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

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

## Phase 7: UX Improvements & Metadata Management 🚀 **IN PROGRESS** (2026-02-02)

### Goal
Improve core user experience and enable library metadata management. Work with Peter Norvig to refine the learning interface.

### Status: **COMPLETE** ✅ (2026-02-02)

**🎉 Phase 7 is COMPLETE!** All core UX improvements implemented and tested!

### Context (From 2026-02-02 Meeting with Peter Norvig)

**Key Pain Points:**
- Homepage shows all libraries, but should only show curated public ones
- No metadata editor for library owners to update title, author, abstract
- Current lesson flow requires too many clicks (graph → click node → start lesson)
- Model too rigid about moving students between concepts
- Students forced to navigate back to graph manually to pick next concept

**Desired Experience:**
- Library homepage shows only manually-curated public libraries
- Library owners can edit metadata from their profile page
- Lesson starts immediately with auto-selected node (no graph navigation)
- Model seamlessly transitions between concepts
- Model more flexible about accepting mastery ("I know this" should suffice)
- Graph becomes supporting tool (modal popup) instead of primary interface

### Tasks

#### 1. About Page Update ✅ **COMPLETE**
- [x] Update `/app/about/page.tsx` with proper origin story:
  - **Name origin:** "lilpaiper" is a portmanteau of "Little Schemer" and "PAIP"
  - **Personal significance:** Beloved Little Schemer book influenced design
  - **Copyright note:** Publisher assigned PAIP copyright back to Peter Norvig
  - Keep existing information about Socratic learning approach
  - Improve clarity and storytelling

#### 2. Change Default Library Visibility ✅ **COMPLETE**
- [x] Update `/app/api/publish/route.ts`:
  - Change `isPublic` default from `true` to `false` (line ~142)
  - New libraries private by default
  - Only custodians/admins can mark as public
- [x] Update database default in schema:
  - Change `is_public BOOLEAN NOT NULL DEFAULT true` → `DEFAULT false`
  - Create migration: `006-default-private-libraries.sql`
  - Apply migration to database
- [x] Test: Create new library, verify it doesn't appear on homepage
- [x] Document: Note in publish page UI that libraries start as private

#### 3. Metadata Editor on User Profile Page ✅ **COMPLETE**

**Goal:** Library owners can edit title, author, abstract from their profile page.

**Implementation Plan:**

**Step 3a: Create Edit Modal Component** ✅
- [x] Create `/app/components/LibraryEditModal.tsx`:
  - Form fields: title, description/abstract
  - Validation: title required, max lengths
  - Save/Cancel buttons
  - Loading states during save
  - Success/error toast notifications
- [x] Use shadcn/ui components (Dialog, Form, Input, Textarea)
- [x] Style to match existing UI aesthetic

**Step 3b: Add PATCH Endpoint** ✅
- [x] Update `/app/api/libraries/[id]/route.ts`:
  - Add `PATCH` handler for library updates
  - Accept fields: `{ title?, description? }`
  - Validate: user is library owner (check `user_id` against session)
  - Update database, return updated library
  - Error handling: 401 (unauthorized), 400 (validation), 500 (server)
- [x] Add database function `updateLibrary(id, userId, updates)` to `/lib/db.ts`

**Step 3c: Integrate Edit UI into Profile Page** ✅
- [x] Update `/app/users/[username]/page.tsx`:
  - Add "Edit" button to each library card (only if viewing own profile)
  - Import `LibraryEditModal` component
  - Pass library data and refresh callback
  - Handle edit modal open/close state
  - Refresh library list after successful edit
- [x] Add visual indicator: ✏️ icon on library cards
- [x] Ensure edit button only visible to library owner

**Step 3d: Testing** ✅
- [x] Test edit flow end-to-end:
  - Sign in as user
  - Navigate to own profile
  - Click edit on a library
  - Update title and description
  - Verify changes persist in database and UI
- [x] Test authorization: Other users can't edit your libraries
- [x] Test validation: Empty title rejected, max lengths enforced
- [x] Test edge cases: Network errors, concurrent edits

#### 4. Major Lesson Page Redesign ✅ **COMPLETE**

**Goal:** Invert current dynamic - learning view primary, graph view secondary.

**Old (Problematic):**
```
Graph View (primary) → Click node → Lesson Modal (popup)
                    ↑ Click back to pick next concept
```

**New (Implemented):**
```
Lesson View (primary) → [Show Map button] → Graph Modal (popup)
    ↓ (automatic)
Next Concept (seamless) → [Show Map button] → Graph Modal (popup)
```

**Implementation Plan:**

**Step 4a: Refactor InteractiveLibrary Component** ✅
- [x] Update `/app/components/InteractiveLibrary.tsx`:
  - **Auto-select starting node** on component mount:
    - Use existing logic: find concepts with no prerequisites (graph roots)
    - If multiple roots, pick first one
    - Open Socratic dialogue immediately (set `dialogueOpen = true`)
  - **Move ConceptGraph to modal**:
    - Create "Overview" or "Map" button in header
    - Graph renders in full-screen modal instead of sidebar
    - Modal has "Select Concept" functionality (keep existing click behavior)
  - **Remove ConceptDetails sidebar** (or make it part of lesson view):
    - Show concept info at top of dialogue instead
  - **New layout**: Full-screen dialogue with minimal chrome
  - **Add "Show Map" button**: Opens graph modal for navigation

**Step 4b: Update SocraticDialogue for Auto-Transitions** ✅
- [x] Update `/app/components/SocraticDialogue.tsx`:
  - **Detect mastery completion** from model response:
    - Model returns `ready_for_mastery: true` flag
    - Model suggests `next_concept_id` in response
  - **Auto-select next concept**:
    - When current concept mastered, use model's suggestion
    - Fallback to frontier logic if no suggestion
  - **Two-turn seamless transition**:
    - Show acknowledgment: "Excellent! You've got it."
    - Trigger confetti 🎉
    - After 500ms delay, auto-send transition request
    - Model returns opening question for next concept
    - Both messages appear in same conversation
    - Update concept title/state in UI
  - **Edge case**: If no next concepts available, show completion message
  - **Removed intra-node progress bar** - Only show overall library progress

**Step 4c: Adjust Model Prompts for Flexibility** ✅
- [x] Update `/app/api/socratic-dialogue/route.ts`:
  - **Add system prompt guidance**:
    - "If student says 'I know this,' give ONE quick verification question"
    - "Accept mastery more readily - trust the student"
    - "Don't require exhaustive demonstration - trust when evidence supports"
    - "Move concept-to-concept smoothly in one conversation"
  - **Add mastery signal** in response format:
    - Return: `{ message, mastery_assessment: { ready_for_mastery: boolean, next_concept_id?: string } }`
    - Frontend uses this to trigger auto-transition
  - **Increased maxOutputTokens** from 1500 to 2500 (fixed truncation bug)
  - Test prompt adjustments with various student responses

**Step 4d: Add Progress Celebrations** ✅
- [x] Add visual feedback for concept completion:
  - Install confetti library: `npm install canvas-confetti`
  - Trigger confetti when concept mastered
  - Update progress bar/counter in header (shows X/Y concepts mastered)
  - Smooth confetti animation between acknowledgment and transition

**Step 4e: Create Graph Modal Component** ✅
- [x] Create `/app/components/GraphModal.tsx`:
  - Full-screen modal with ConceptGraph
  - Same click-to-select behavior as before
  - "Close" button returns to lesson
  - When node clicked, close modal and start/resume dialogue for that concept
  - Show mastery states in graph (mastered/current/available/locked)

**Step 4f: Testing & Refinement** ✅
- [x] Test complete learning flow:
  - Open library → Lesson starts immediately with root concept ✅
  - Complete concept → Seamlessly transitions to next ✅
  - Click "Show Map" → Graph modal opens ✅
  - Click different concept in graph → Lesson switches to that concept ✅
  - Complete all concepts → Completion message shown ✅
- [x] Test flexibility:
  - Say "I know this" → Model gives quick check, moves on ✅
  - Model accepts mastery more readily ✅
  - Two-turn transition works smoothly ✅
- [x] Fixed syntax error in SocraticDialogue.tsx (extra closing div)
- [x] Fixed JSON truncation bug (increased maxOutputTokens)

### Success Criteria

**Phase 7 Complete When:**
- ✅ About page tells the lilpaiper origin story
- ✅ New libraries default to private (is_public = false)
- ✅ Library owners can edit title, author, abstract from profile page
- ✅ Lesson starts immediately with auto-selected concept (no graph navigation)
- ✅ Model seamlessly transitions between concepts (no manual navigation)
- ✅ Model accepts "I know this" with minimal verification
- ✅ Graph available as modal popup for overview/manual selection
- ✅ Visual celebration (confetti/progress) when concepts mastered
- ✅ Peter Norvig approves of new learning flow

### Implementation Order (Today's Plan)

**Morning (3-4 hours):** ✅ **COMPLETE**
1. ✅ Update about page (15 min)
2. ✅ Change default visibility to private (15 min + migration)
3. ✅ Build metadata editor (2-3 hours)
   - Edit modal component
   - PATCH endpoint
   - Integration with profile page
   - Testing

**Afternoon (3-4 hours):** ✅ **COMPLETE**
4. ✅ Lesson page redesign (3-4 hours)
   - Refactor InteractiveLibrary
   - Auto-select starting node
   - Move graph to modal
   - Auto-transition between concepts
   - Adjust model prompts
   - Progress celebrations
   - Fixed syntax errors
   - Fixed JSON truncation bug
   - Testing with Peter

**End of Day:**
- Demo to Peter
- Gather feedback
- Make any quick adjustments
- Document changes in CHANGELOG.md

**Future Enhancements (Phase 7.5):**
- [ ] Make graph modal draggable/resizable (like Gmail compose windows)
  - Drag by header to reposition
  - Minimize to bottom-right corner
  - Restore from minimized state
  - Multiple concepts can have minimized graphs simultaneously

**Performance Issue: Markdown Rendering (CRITICAL - 2026-02-02)**

**Problem:** Large markdown documents (notebooks, source material) cause browser tab to freeze
- ReactMarkdown re-parses entire document on every render
- Heavy processing: remarkGfm, remarkMath, rehypeKatex, syntax highlighting
- Documents can be 10KB-500KB+, all processed in browser main thread

**Immediate Fix Applied (2026-02-02):**
- ✅ **Memoized MarkdownViewer to prevent unnecessary re-renders** ← THIS WAS THE FIX!
  - Component only re-renders when content or anchor actually changes
  - Prevents re-parsing markdown on every dialogue message
  - UI now snappy even with large notebooks

**Proper Long-Term Solution (TODO - Phase 8):**
- [ ] **Pre-compile Markdown to HTML server-side during library processing**
  - Add `markdown_html` column to `segments` table (TEXT or JSONB)
  - During `scripts/process-library.ts`, compile markdown → HTML using fast server-side library
    - Options: `marked` (fast, simple), `remark` (same as frontend), or `markdown-it`
    - Include syntax highlighting server-side (Prism or highlight.js)
    - Include math rendering (KaTeX server-side)
  - Store pre-compiled HTML in database alongside markdown
  - Migration: `008-add-precompiled-html.sql`
  - Retroactive processing script for existing libraries
  
- [ ] **Update frontend to use pre-compiled HTML**
  - API returns `html_content` instead of forcing client-side compilation
  - Replace ReactMarkdown with simple dangerouslySetInnerHTML (after sanitization)
  - Remove heavy remark/rehype plugins from frontend bundle
  - Add DOMPurify for HTML sanitization if needed
  - Keep syntax highlighting CSS, remove Prism/SyntaxHighlighter components
  
- [ ] **Expected Performance Gains**
  - 10-100x faster rendering (no parsing, just DOM insertion)
  - Works for any document size (even 1MB+ notebooks)
  - Smaller frontend bundle (remove ReactMarkdown + plugins)
  - Better mobile performance
  - Instant tab switching

**Implementation Estimate:** 2-3 hours
  - 30 min: Add column, write migration
  - 1 hour: Update processing script to compile HTML
  - 30 min: Update API to return HTML
  - 30 min: Update frontend to consume HTML
  - 30 min: Test and verify

**Priority:** High - blocking beta testing with Peter Norvig

---

## Phase 6: Pedagogical Improvements & Project-Based Learning

### Goal
Balance Socratic questioning with material access, and enable coherent project-based exercises.

### Context (From 2024-12-22 Meeting with Peter Norvig)
**Key Insights:**
- Students frustrated by lack of access to reading material during dialogue
- Current system too question-heavy; need better balance
- "Too easy" feedback - students not building anything substantial
- LLMs can easily write functions, but can't do conceptual work
- Need exercises like "define concept in your own words" vs "write this function"
- Missing: Coherent projects that stitch fragments together (e.g., robot control)

### Tasks

#### 1. Material Access During Dialogue ⚡ **HIGH PRIORITY**
- [ ] **Add "View Source" button in Socratic dialogue** - Quick access to relevant segments
- [ ] **Show material preview in dialogue** - Expandable sections with context
- [ ] **Balance question types**:
  - More "define in your own words" conceptual questions
  - Fewer "implement this function" questions (LLMs can do this)
- [ ] **Adjust system prompt** - Encourage more reading before questioning
- [ ] **Add "Read more" suggestions** - Direct students to relevant material

#### 2. Project-Based Learning Framework 🎯 **GOAL: THIS FRIDAY**

##### 2a. Function Extraction & Unit Testing (New - 2026-01-16)

**Context:** Enable unit test-based mastery demonstration. Students can click "I got this" and go straight to coding exercises with automated test feedback.

**Key Architectural Decision:**
Extract a **complete, coherent, runnable program** from the notebook FIRST, then map functions to concepts. This ensures:
- ✅ **Coherence** - Functions work together (dependencies intact)
- ✅ **Completeness** - All imports, type aliases, helpers included
- ✅ **Testability** - Can verify the extracted program runs
- ✅ **Monkey-patchable** - Student implements one function, we test it in the context of the complete working program

**Example:** TSP notebook → `tsp_complete.py` (200-300 lines) → Parse out 15-20 functions → Associate with concepts → Generate tests that use complete program context

**Database Schema:**
- [ ] Create `library_programs` table:
  - `id`, `library_id` (UNIQUE), `program_code`, `language`
  - `metadata` (JSONB - version, extracted_at)
  - Stores complete, coherent, runnable program extracted from notebook
- [ ] Create `concept_functions` table:
  - `id`, `library_id`, `concept_id`, `function_name`
  - `function_signature`, `function_body`, `docstring`
  - `line_start`, `line_end` (position in complete program)
  - `dependencies` (TEXT[] - function names this function calls)
  - `test_cases` (JSONB - generated unit tests)
- [ ] Create migration script and apply to database
- [ ] Add indexes: `idx_concept_functions_library_id`, `idx_concept_functions_concept_id`

**Program Extraction Pipeline (Two Stages):**

**Stage 5a: Extract Complete Program** ✅ **COMPLETE**
- [x] Write `scripts/extract-program.ts`:
  - Use Gemini to extract all executable code from notebook
  - Prompt: "Extract a complete, runnable Python program from this notebook"
  - Preserve imports, type aliases, helper functions, all algorithms
  - Output: Complete Python file that can run standalone
  - **Add verification tests** - Simple smoke tests to validate extraction:
    - Functions exist and are callable
    - Basic sanity checks (e.g., `nearest_neighbor(cities)` returns valid tour)
    - If verification fails, use auto-fix loop (up to 3 attempts)
  - **Auto-fix loop** - Send errors back to Gemini for fixing
- [x] Test on TSP notebook:
  - Produced 356 lines of working Python code
  - All functions present and properly ordered (dependencies before usage)
  - Imports at top, type aliases, then functions
  - Verification tests pass (after 1-2 fix attempts)

**Stage 5b: Map Functions to Concepts + Generate Mastery Tests**
- [ ] Write `scripts/map-functions-to-concepts.ts`:
  - Parse the complete program for function definitions (use AST or regex)
  - Use Gemini to associate each function with concept(s)
  - Identify dependencies: which functions call which (AST analysis)
  - **Generate mastery tests for each function** (3-5 tests per function):
    - Prompt includes: complete program, function code, associated concept
    - Tests should verify: correctness, concept understanding, edge cases
    - Tests must use program context (helpers like `random_cities`, `tour_length`)
    - Format: `{name, setup, code, points, description}` (see NOTES.md)
  - Output JSON with function metadata + dependencies + test_cases
- [ ] Test on TSP complete program:
  - Should identify ~15-20 functions
  - Verify concept associations: `nearest_neighbor` → "Greedy Algorithms"
  - Check dependencies: `nearest_neighbor` calls `distance`, `tour_length`
  - **Verify test generation quality:**
    - Each function has 3-5 tests
    - Tests use program helpers (`random_cities(10, seed=42)`)
    - Tests check correctness AND concept understanding (e.g., greedy quality)
    - Tests are deterministic (same seed values)

**Integration into Pipeline:**
- [ ] Update `lib/processing.ts`:
  - Add stage 5a: Extract program (55% progress)
  - Add stage 5b: Map functions (60% progress)
  - Only runs for notebook/markdown content types
  - Save complete program to `library_programs` table
  - Save function mappings to `concept_functions` table

**Retroactive Processing:**
- [ ] Write `scripts/retroactive-function-extraction.ts`:
  - Fetch all notebook/markdown libraries from database
  - Run function extraction on each
  - Save results to `concept_functions` table
- [ ] Test on existing TSP library
- [ ] Run on all libraries (can be done anytime after extraction script is ready)

**API Endpoints:**
- [ ] `GET /api/libraries/[id]/program` - Fetch complete program code
  - Returns: `{ programCode: string, language: string }`
  - Used to pre-load program context in Pyodide
- [ ] `GET /api/concepts/[id]/exercise` - Fetch exercise for a concept
  - Returns: `{ function: {...}, programContext: string, testCases: [...] }`
  - `programContext` = complete program MINUS the target function
  - Used by coding interface to set up exercise environment

**Coding Interface (Phase 2 Integration):**
- [ ] Create `CodeMasteryExercise.tsx` component:
  - Shows concept learning objectives
  - Code editor with function stub (only target function visible)
  - "Run Tests" button
  - Test results display (X/Y passing, with details)
  - Uses existing Pyodide scratchpad for execution
- [ ] Integrate with Python scratchpad (monkey-patch approach):
  - **Pre-load program context** in Pyodide (hidden from student):
    - `exec(programContext)` - Loads all imports, helpers, dependencies
    - Student doesn't see this code
  - **Show only target function** in editor:
    - Function signature + docstring
    - Student writes implementation body
  - **Execute tests** in Pyodide:
    - Student's function definition runs in context with all dependencies
    - Tests call student's function with helpers available (`random_cities`, etc.)
    - Parse test output (pass/fail per test case)
  - Show progress: "3/5 tests passing"
- [ ] Handle edge cases:
  - Syntax errors in student code
  - Runtime errors during test execution
  - Infinite loops (timeout after 5 seconds)

**"I Got This" Button Integration:**
- [ ] Add button to concept UI in InteractiveLibrary:
  - Shows next to "Start Learning" or in concept graph node
  - Only visible if concept has associated functions
- [ ] Implement mode switching:
  - `setMode('coding')` transitions from dialogue to coding interface
  - Fetches functions for concept via API
  - Loads first function as exercise
- [ ] Handle completion:
  - Mark concept as mastered when all tests pass
  - Option to continue to next concept or return to graph

**Success Criteria:**
- ✅ TSP notebook → complete program (~200-300 lines, verification tests pass)
- ✅ ~15-20 functions extracted and mapped to concepts
- ✅ Each function has 3-5 context-aware mastery tests
- ✅ Tests are deterministic and use program helpers
- ✅ "I got this" → coding interface with pre-loaded context
- ✅ Students write target function, tests run in full program context
- ✅ All tests passing = concept mastered
- ✅ Test output shows: "✓ test_basic_correctness: PASS" format

**Implementation Priority:** **HIGH** (Peter wants this by Friday)

---

##### 2b. Project-Based Learning (Original Plan)
- [ ] **Define project structure** - How to represent multi-step coherent projects
- [ ] **Example: Robot control project** - Stitch together:
  - Motor control basics
  - Sensor integration
  - Navigation algorithms
  - Complete working robot
- [ ] **Project database schema** - Store project definitions, milestones, code checkpoints
- [ ] **Project templates** - Starter projects users can import
- [ ] **Reference: Exercise notebooks** - Study https://github.com/jerry-git/learn-python3/blob/master/notebooks/beginner/exercises/01_strings_exercise.ipynb

#### 3. Import Metadata & Customization 📝 **MEDIUM PRIORITY**
- [ ] **Expose system prompts during import** - Let users customize:
  - Concept extraction instructions
  - Chunking strategy
  - Question types to generate
- [ ] **Metadata fields during import**:
  - Title (with smart defaults from content)
  - Abstract/summary (user-provided or AI-generated)
  - Keywords/tags (for discovery)
- [ ] **Markdown frontmatter support** - Define simple format:
  ```markdown
  ---
  title: "My Python Tutorial"
  abstract: "Learn Python basics..."
  keywords: [python, beginner, tutorial]
  system_prompt: "Focus on conceptual understanding..."
  ---
  # Content starts here...
  ```
- [ ] **Metadata form on publish** - Optional fields, not required every time
- [ ] **Smart defaults** - Extract from content when possible

#### 4. Versioning & Iteration 🔄 **MEDIUM PRIORITY**
- [ ] **GitHub-style branching** - Inspiration for library versions
- [ ] **Overwrite vs. Create New** - When re-importing:
  - Option 1: Overwrite existing library (update in place)
  - Option 2: Create new version (keep history)
- [ ] **Version history UI** - Show timeline of updates
- [ ] **Compare versions** - Diff concept graphs between versions

#### 5. Exercise Design Patterns 📚 **RESEARCH**
- [ ] **Study effective exercise types**:
  - ✅ "Define X in your own words" (conceptual, LLM-proof)
  - ✅ "Explain why Y happens" (understanding)
  - ❌ "Write function to do Z" (too easy for LLMs)
  - ✅ "Debug this code" (requires reasoning)
  - ✅ "Design system architecture" (synthesis)
- [ ] **Categorize question types** - Tag concepts with difficulty/type
- [ ] **Adaptive questioning** - Adjust based on student responses
- [ ] **Project milestones** - Break coherent projects into checkpoints

### Success Criteria
- Students can access material without leaving dialogue
- Coherent project example working by Friday
- Import flow includes metadata customization
- Exercise types promote conceptual understanding over code generation
- Code fragments connect into meaningful projects

---

## Notes

- Keep existing static files (PAIP, TSP) for reference during migration
- Workshop deadline drives Phase 1 timeline
- Auth (Phase 3) can wait until post-workshop
- Focus on reliability over features for workshop MVP
- **Semantic segmentation is working as designed** - Video style affects segment density
