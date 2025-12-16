# Changelog

All notable changes to the Little PAIPer learning platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### 2024-12-16 - Semantic URL Generation for YouTube Videos

**Progress:** Fixed YouTube video imports to generate stable, semantic URLs from video titles instead of cryptic video IDs. URLs now look like `/users/klutometis/python-in-100-seconds` instead of `/users/klutometis/x7X9w_GIm1s`.

#### Fixed
- **Semantic slug generation** (`app/api/publish/route.ts`):
  - Fetches real YouTube metadata (title, author) synchronously during publish
  - Generates slug from video title before creating library record
  - Falls back gracefully if metadata fetch fails
  - Uses video title for semantic URLs: "Python in 100 Seconds" → `python-in-100-seconds`
- **Slug stability during processing** (`scripts/process-library.ts`):
  - Removed slug update from final processing stage
  - Slug is now set once at creation time and never changed
  - Processing only updates title and stats, not slug
  - Prevents URL breakage during long-running imports
- **Re-import flow** (`app/api/publish/route.ts`):
  - Updates in-memory library object after database UPDATE
  - Ensures redirect URL matches new slug
  - Re-imports now correctly update from video ID to semantic slug

#### Added
- **YouTube metadata fetching** (`app/api/publish/route.ts`):
  - `extractYouTubeId()` - Parse video ID from various URL formats
  - `fetchYouTubeMetadata()` - Sync call to `scripts/youtube/fetch-video-info.ts`
  - Reads `youtube/{videoId}/video-info.json` for title and author
  - 10-second timeout with graceful fallback
  - Author metadata properly flows to library record

#### Architecture Benefits
- ✅ **Readable URLs** - Human-friendly slugs instead of video IDs
- ✅ **Stable links** - URLs never change once created
- ✅ **SEO-friendly** - Descriptive slugs improve discoverability
- ✅ **Consistent experience** - Same URL pattern for all content types

#### Testing
- ✅ New import: "Python in 100 Seconds" → `/users/klutometis/python-in-100-seconds`
- ✅ Re-import: Updated old video ID slug to semantic slug
- ✅ Processing preserves slug throughout pipeline
- ✅ Video metadata (title, author) correctly fetched from YouTube
- ✅ Fallback works when metadata unavailable

#### Status
**Phase 1b Priority Complete** ✅ - Semantic URLs working end-to-end!

🎯 **Next:** Create `scripts/process-library.ts` wrapper to route content processing

---

### 2024-12-16 - Navigation UI Improvements

**Progress:** Fixed text contrast and visibility issues in navigation header. Dark floating navigation pill now provides consistent styling across both light and dark page backgrounds.

#### Fixed
- **Text contrast in library header** (`app/components/InteractiveLibrary.tsx`):
  - Changed author byline from `text-slate-300` to `text-slate-100`
  - Now readable on dark blue gradient background
- **Dark navigation pill** (`app/layout.tsx`):
  - Added semi-transparent dark background: `bg-slate-900/90 backdrop-blur-sm`
  - Floating pill design with rounded corners and shadow
  - Works perfectly on both light (home page) and dark (library) backgrounds
- **Username visibility** (`components/AuthButton.tsx`):
  - Changed username text to `text-white` (was inheriting dark color)
  - Added `hover:bg-slate-800` to "Sign out" button for better contrast
  - All navigation text now consistently white on dark background
- **About button styling** (`app/layout.tsx`):
  - Updated to dark theme: `bg-slate-800 border-slate-700 text-white`
  - Matches navigation pill aesthetic

#### Architecture Notes
- **Consistent navigation pattern**: Dark floating pill solves the "light text on light background" problem
- **Professional appearance**: Similar to GitHub, Discord, and other modern web apps
- **Accessibility**: High contrast white-on-dark meets WCAG standards
- **Responsive backdrop blur**: Creates depth and visual polish

#### Status
**UI Polish Complete** ✅ - Navigation header now works beautifully on all page backgrounds!

🎯 **Next:** Build processing pipeline script (`scripts/process-library.ts` wrapper)

---

### 2024-12-15 - Progress Callback System Fixed

**Progress:** Fixed critical bug where progress updates were not reaching the database during library processing. Real-time status updates now work correctly with async database writes.

#### Fixed
- **Progress callback async handling** (`lib/processing.ts`):
  - Changed `ProgressCallback` type to support `Promise<void> | void`
  - Added `await` to all 24 `onProgress?.()` calls throughout the file
  - Progress updates were fire-and-forget, abandoning database writes before completion
  - Now properly waits for each database update before continuing to next stage
- **Database status tracking** working end-to-end:
  - Console logs showed "Transcribing audio: 25%" but database stayed at "Initializing..."
  - Root cause: async `updateProgress()` calls were not awaited
  - Now updates flow correctly: pending → processing (with progress) → ready

#### Testing
- ✅ Processed library `88b2316d-16e1-491f-bc2c-8613b8839b77` (Python in 100 Seconds video)
- ✅ Frontend polling showed real-time updates: 10% → 20% → 25% → 40%...
- ✅ Progress messages displayed correctly: "Downloading video", "Transcribing audio", etc.
- ✅ Stage indicators updated in real-time (green checkmarks for completed, blue pulse for in-progress)
- ✅ Database queries confirmed `progress_message` field updating correctly

#### Architecture Notes
- **ProgressCallback signature**: Now explicitly supports both sync and async callbacks
- **All processing functions affected**: `processYouTubeVideo()`, `processMarkdownFile()`, `processJupyterNotebook()`
- **Pattern established**: Always await progress callbacks to ensure database consistency

#### Status
**Phase 1b Priority 1 Complete** ✅ - Progress tracking now production-ready!

🎯 **Next:** Wire up Cloud Run Job to trigger processing from `/api/publish` route

---

### 2024-12-15 - Library Publishing Infrastructure Complete

**Progress:** Built complete publishing flow with async processing architecture. Users can now paste URLs at `/publish`, libraries are created immediately with status tracking, and polling keeps the UI updated during processing.

#### Added
- **`/api/libraries/[id]` route** - Polling endpoint for library status updates
  - Returns library metadata, status, progress_message, error_message
  - Validates UUID format before querying database
  - Enables real-time status updates without page refresh
- **`/publish` page** - Publishing interface with URL input
  - Auto-detects source type (YouTube, GitHub notebook, markdown)
  - Shows detected source info before publishing
  - Requires authentication (redirects to sign-in if not logged in)
  - Redirects to library status page immediately after creation
- **`/api/publish` route** - Fast synchronous library creation
  - Validates and parses source URLs
  - Creates library record with `status: 'pending'`
  - Generates unique slug with collision handling (title, title-2, etc.)
  - Returns library ID and redirect URL to status page
  - TODO: Trigger Cloud Run Job for actual processing
- **Database schema update** - Added `progress_message` column
  - Stores human-readable progress updates during processing
  - Migration 003: `ALTER TABLE libraries ADD COLUMN progress_message TEXT`
  - Applied and tested successfully
- **Enhanced `LibraryStatusPage.tsx`** - Client-side polling implementation
  - Polls `/api/libraries/[id]` every 5 seconds when status is `pending` or `processing`
  - Stops polling automatically when status reaches `ready` or `failed`
  - Shows spinner and "Checking for updates..." indicator during polling
  - Displays progress_message in blue info box when present
  - Auto-refreshes to interactive library when processing completes

#### Fixed
- **UUID parsing bug** (`/api/libraries/[id]/route.ts`):
  - Was calling `parseInt(id, 10)` which converted UUIDs to integers
  - "88b2316d-16e1-491f-bc2c-8613b8839b77" became "88" causing database errors
  - Now validates UUID format with regex and passes string directly
  - Fixed PostgreSQL error: "invalid input syntax for type uuid"

#### Changed
- **Async processing architecture established**:
  - Phase 1: `/api/publish` creates library record (~1 second, synchronous)
  - Phase 2: Cloud Run Job processes content (10-30 minutes, async) - TODO
  - Phase 3: Status page polls for updates and auto-refreshes when ready
  - Decouples library creation from processing (no more timeouts)

#### Testing
- ✅ Published YouTube video: "Getting Started with Python in Less Than 10 Minutes"
- ✅ Library created with UUID: `88b2316d-16e1-491f-bc2c-8613b8839b77`
- ✅ Redirected to `/users/klutometis/youtube-video` immediately
- ✅ Status page showed "Pending" with polling indicator
- ✅ Manually updated database to test status transitions:
  - `pending` → Green "⏳ Pending" badge, polling active
  - `processing` → Blue "⚙️ Processing" badge, progress message shown, polling continues
  - `ready` → Green "✅ Ready" badge, polling stopped, processed timestamp displayed
- ✅ Polling stopped automatically when status changed to `ready`
- ✅ No more UUID parsing errors in API logs
- ✅ Progress messages displayed correctly in UI

#### Architecture Benefits
- ✅ **Fast publishing** - Libraries created instantly, no waiting for processing
- ✅ **Resilient** - Processing happens independently, survives client disconnects
- ✅ **Real-time updates** - Polling keeps users informed without manual refresh
- ✅ **Clean separation** - Library creation (sync) vs. processing (async)
- ✅ **Scalable** - Ready for Cloud Run Job integration

#### Status
**Phase 1b Priority 1 Complete** ✅ - Publishing infrastructure and status polling working end-to-end!

🎯 **Next:** Wire up processing script (`scripts/process-library.ts`) that routes to YouTube/markdown/notebook processors and updates database status.

---

### 2024-12-15 - Interactive Library Refactoring Complete

**Progress:** Eliminated code duplication between demo and user libraries by creating a reusable `InteractiveLibrary` component. User-owned libraries now support full interactive learning when ready.

#### Added
- **`InteractiveLibrary.tsx`** - Reusable component encapsulating all interactive functionality:
  - Concept graph visualization with D3 force simulation
  - Concept details sidebar with prerequisites and learning objectives
  - Socratic dialogue integration with mastery tracking
  - Learning progress dashboard with statistics and encouragement
  - localStorage-based mastery persistence
  - Ready/locked/recommended concept calculations based on prerequisites
- **`LibraryStatusPage.tsx`** - Client component for displaying library metadata and processing status
  - Different messaging for `pending`, `processing`, `failed`, and `ready` states
  - Clean separation of concerns from interactive experience
- **`LibraryInteractivePage.tsx`** - Client wrapper that passes user library data to `InteractiveLibrary`
  - Handles navigation back to user profile
  - Bridges server component data to client interactive component

#### Changed
- **Refactored `/library/[slug]/page.tsx`**:
  - Simplified to load demo libraries from API
  - Delegates all interactive logic to `InteractiveLibrary` component
  - Zero duplication with user library experience
- **Updated `/users/[username]/[slug]/page.tsx`**:
  - Changed to server component that queries database
  - Conditionally renders `LibraryInteractivePage` when `status === 'ready'` and concept graph exists
  - Renders `LibraryStatusPage` for `pending`/`processing`/`failed` states
  - Double-duty page: status during import → interactive library when ready

#### Fixed
- **Code duplication eliminated**: Demo and user libraries now share the same interactive experience
- **User library interactivity**: Personal libraries at `/users/{username}/{slug}` now fully functional
- **Mastery tracking working**: localStorage persists progress across sessions
- **Progress dashboard functional**: Shows mastery count, recommended concepts, and encouragement

#### Architecture Benefits
- ✅ **Single source of truth** for interactive library experience
- ✅ **Consistent UX** between demo and user-owned content
- ✅ **Easier maintenance** - interactive features only defined once
- ✅ **Better separation** - server data fetching vs. client interactivity
- ✅ **Reusable component** - can be used for any library source in the future

#### Testing
- ✅ Demo libraries work: `/library/paip` loads and functions correctly
- ✅ User libraries work: `/users/klutometis/python-intro-chapter-1` shows interactive experience when ready
- ✅ Status page works: Shows appropriate messaging for processing states
- ✅ Mastery tracking persists: Progress saved to localStorage correctly
- ✅ No code duplication: Interactive logic exists only in `InteractiveLibrary.tsx`

#### Status
**Phase 1a Complete** ✅ - User libraries now have full interactive capability matching demo libraries!

🎯 **Next:** Phase 1b - Build `/publish` route and import pipeline for content ingestion

---

### 2024-12-15 - GitHub Authentication System Complete

**Progress:** Implemented GitHub OAuth authentication with NextAuth v4 and database-backed user persistence. Full authentication UI with profile links using unique GitHub usernames.

#### Added
- **GitHub OAuth provider** configured with NextAuth v4
- **User database persistence** (`lib/auth.ts`):
  - Saves GitHub profile data on sign-in
  - Updates user info and `last_login_at` on subsequent logins
  - Graceful error handling (OAuth works even if DB save fails)
- **Users table** already existed in schema from earlier migration
- **Authentication API routes** (`app/api/auth/[...nextauth]/route.ts`):
  - `GET /api/auth/signin` - Built-in NextAuth sign-in page
  - `POST /api/auth/signin/github` - GitHub OAuth initiation
  - `GET /api/auth/callback/github` - OAuth callback handler
- **Session username extraction** (`lib/auth.ts`):
  - Added `jwt` callback to extract GitHub `login` from OAuth profile
  - Added username to session via `session` callback
  - Profile links now use unique GitHub username instead of display name
- **Authentication UI components** (`components/AuthButton.tsx`):
  - Sign in button with GitHub branding
  - User menu with avatar, username, and sign out
  - Profile link to `/users/{username}` (e.g., `/users/klutometis`)
  - Integrated into app layout header
- **Next.js image configuration** (`next.config.ts`):
  - Whitelisted `avatars.githubusercontent.com` for GitHub avatar images
  - Configured `remotePatterns` for secure external image loading

#### Fixed
- **NextAuth v4 vs v5 API confusion**:
  - Was using v5 syntax (`handlers` export) but had v4 installed
  - Corrected to v4 API (`authOptions` export + `NextAuth(authOptions)`)
- **Custom sign-in page 404**: Removed non-existent `/auth/signin` reference
- **OAuth state cookie errors**: Fixed by using default NextAuth sign-in page
- **GitHub avatar loading**: Fixed "hostname not configured" error by adding to Next.js image config
- **Profile link uniqueness**: Changed from display name to GitHub username for stable URLs

#### Testing
- ✅ Full OAuth flow working (GitHub → callback → session)
- ✅ User `klutometis` authenticated and saved to database
- ✅ Database record verified: `github_login`, `github_name`, `created_at` all correct
- ✅ No more OAuth errors or state cookie issues
- ✅ Username extraction to session (requires re-login after jwt callback added)
- ✅ Profile link correctly uses `/users/klutometis` (not `/users/Peter%20Danenberg`)
- ✅ Avatar images load from GitHub CDN without errors
- ✅ Sign out and re-sign in flow works correctly

#### Architecture Notes
- **GitHub username as URL identifier**: Uses unique `login` field instead of mutable display name
- **JWT callback timing**: Username extraction only runs on sign-in, not every request
- **Session token updates**: Existing sessions need re-login to get new fields
- **Image security**: Next.js requires explicit domain whitelisting for external images

#### Status
**Phase 1a (Authentication & Personal Libraries):** ✅ Complete
- ✅ GitHub authentication working end-to-end
- ✅ User persistence in database
- ✅ Profile UI with avatars and usernames
- ✅ Unique, stable profile URLs
- ✅ Personal library list page: `/users/{username}`
- ✅ Individual library status page: `/users/{username}/{slug}`
- 🎯 Next: Make library page show interactive experience when `ready` (concept graph, Socratic dialogue)
- 🎯 Next: Build `/publish` route and import pipeline (Phase 1b)

#### Architecture Notes
- **URL structure:** User-namespaced pattern (`/users/[username]/[slug]`) chosen over global slugs (`/library/[slug]`)
  - Rationale: Like GitHub repos, enables forking, natural sharing, no slug conflicts
  - Legacy `/library/[slug]` pattern remains for demo libraries (PAIP, etc.)
- **Double-duty page:** `/users/[username]/[slug]` shows status during processing, then becomes interactive library when ready
- **Library management:** Contextual controls (⚙️ Settings dropdown) will appear for owners, not separate settings pages

---

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
