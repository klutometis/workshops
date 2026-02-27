# Chapters (Books) Plan

## Problem

Libraries are flat — every library appears as a standalone card on the home
page. For PAIP we need to group libraries into ordered chapters under a single
"book" heading.

## Terminology

| Term in code | What it means |
|---|---|
| `chapters` table row | A **book** (e.g. "PAIP — Paradigms of AI Programming") |
| `libraries` row with `chapter_id` set | A **chapter** of that book |
| `libraries` row with `chapter_id = NULL` | A **standalone library** (unchanged behaviour) |

The naming is slightly confusing (`chapters` table = books), but it avoids
adding a third level of hierarchy. A "chapter" IS a library — it just happens
to belong to a book.

## Data model

### Migration: `scripts/migrations/008-add-chapters.sql`

```sql
-- chapters table (= books)
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  order_index INTEGER,          -- ordering among books
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_chapter_slug UNIQUE (user_id, slug)
);

-- libraries gains two columns
ALTER TABLE libraries
  ADD COLUMN chapter_id    UUID REFERENCES chapters(id) ON DELETE SET NULL,
  ADD COLUMN chapter_order INTEGER;  -- position within its book
```

### Applying the migration

```bash
# 1. Start the Cloud SQL proxy (in a separate terminal)
cd learning && ./scripts/start-db-proxy.sh

# 2. Run the migration
./scripts/apply-migration.sh 008-add-chapters
```

The proxy must be running because `apply-migration.sh` uses
`LEARNING_DATABASE_URL_PROXY` which points at `localhost:5432`, forwarded by
the Cloud SQL proxy to the remote database.

## Home page UX

**Decision:** Expanded sections (always visible).

Books render as a titled `<section>` with their chapters in a 2-column grid
below. Standalone libraries appear in a separate section underneath.

```
Little PAIPer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAIP — Paradigms of AI Programming
  [Ch 1: Intro to Lisp]  [Ch 2: Simple Lisp Program]
  [Ch 3: Overview]       [Ch 4: GPS]

Libraries
  [Pytudes]  [CS229]
```

**Pivot plan:** If the home page gets too long, switch to a collapsible card
per book (click to expand). The data model doesn't change — only the
`LibrarySelector` component.

## Book assignment workflow (Option B)

Books are assigned **post-publish** via the "Edit Metadata" modal on the user
profile page. The publish form stays untouched.

If needed later, we can add optional book fields to the publish form inline
(Option C pivot).

### Changes required

| File | Change |
|---|---|
| `lib/db.ts` | Extend `updateLibrary()` to accept `chapter_id`, `chapter_order`. Add `getChaptersByUserId()`. |
| `app/api/libraries/[id]/route.ts` | Accept + validate `chapter_id` and `chapter_order` in PATCH body. |
| `app/api/chapters/route.ts` | Add `?mine=true` query param (returns authed user's books). Add `POST` handler to create a new book. |
| `app/components/LibraryEditModal.tsx` | Add "Book" dropdown (existing books + "Create new...") and "Chapter order" number input. On save, create book first if needed, then PATCH library. |

### Edit modal UX (rough sketch)

```
Title:        [PAIP Chapter 1: Introduction to Lisp  ]
Author:       Peter Norvig (read-only)
Description:  [                                       ]

Book:         [ PAIP ▾ ]   (dropdown: None | PAIP | Create new...)
Chapter #:    [ 1 ]

[x] Public (admin only)

                              [Cancel]  [Save Changes]
```

If "Create new..." is selected, a text input appears for the book title.
The slug is auto-derived. On save, a `POST /api/chapters` creates the book
first, then the library PATCH uses the returned `chapter_id`.

## What's done

- [x] Migration SQL (`008-add-chapters.sql`)
- [x] DB helpers in `lib/db.ts` (`getPublicChaptersWithLibraries`, `getPublicLibraries(standaloneOnly)`, `createChapter`, `assignLibraryToChapter`, `getChapterBySlug`)
- [x] `GET /api/chapters` route (returns public books + their libraries)
- [x] `GET /api/libraries` updated (standalone-only by default, `?all=true` for everything)
- [x] `app/page.tsx` fetches both chapters and standalone libraries
- [x] `LibrarySelector` renders expanded sections for books, standalone libraries below

## What's remaining

- [x] Apply migration to production DB (requires proxy)
- [x] Extend `updateLibrary()` to handle `chapter_id` / `chapter_order`
- [x] Add `getChaptersByUserId()` to `lib/db.ts`
- [x] PATCH `/api/libraries/[id]` — accept `chapter_id`, `chapter_order`
- [x] GET/POST `/api/chapters` — add `?mine=true` and POST handler
- [x] `LibraryEditModal` — add Book dropdown + Chapter Order fields
- [x] Fix `processMarkdownFile` to download URLs (was local-path only)
- [x] `scripts/process-url.ts` — end-to-end: URL in → processed library out
- [x] Public toggle restricted to admins (klutometis, norvig)
- [ ] Collapsible book display on homepage (Option C — see below)
- [ ] Book management UI (make books public/private, rename, delete)

## End-to-end processing script

```bash
# Basic: just process a URL
npx tsx scripts/process-url.ts <url>

# Full: process and assign to a book
npx tsx scripts/process-url.ts \
  https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md \
  --book "Paradigms of AI Programming" \
  --chapter-order 1 \
  --public --public-book
```

Flags: `--book`, `--chapter-order`, `--title`, `--public`, `--public-book`.

Libraries and books default to **private**. Use `--public` / `--public-book`
to make them visible on the home page, or toggle via the Edit Metadata modal
on the user profile page (library owners now see the Public checkbox).

## Visibility

- **Libraries**: admins only (`klutometis`, `norvig`) can toggle public/private
  via the Edit Metadata modal. Enforced in both the API (403 for non-admins)
  and the frontend (checkbox only renders for admins).
  Admin list lives in `lib/auth.ts` as `ADMIN_USERNAMES`.
- **Books**: no UI yet — use `--public-book` in the script, or SQL:
  ```sql
  UPDATE chapters SET is_public = true WHERE slug = 'paradigms-of-ai-programming';
  ```

## Collapsible book display (upcoming)

**Problem:** With 25 PAIP chapters, the expanded 2-column grid takes up the
entire homepage. It'll only get worse with more books.

**Decision:** Option C — collapsed by default + compact numbered list on expand.

### Collapsed state (default)

```
▶ Paradigms of Artificial Intelligence Programming
  25 chapters · 450 concepts · ~120 hours
```

Book title is a clickable header with chevron. Summary line shows aggregate
stats. Click to expand.

### Expanded state

```
▼ Paradigms of Artificial Intelligence Programming
  25 chapters · 450 concepts · ~120 hours

  1. Introduction to Lisp           25 concepts · 2.5 hrs
  2. A Simple Lisp Program          25 concepts · 2.5 hrs
  3. Overview of Lisp               31 concepts · 16 hrs
  ...
  25. Troubleshooting                12 concepts · 1 hr
```

Chapters render as a compact numbered list (not full cards). Each row is
clickable and navigates to the library. Much denser — 25 chapters fits in
the same vertical space as ~4-5 cards.

### Standalone libraries

Libraries without a `chapter_id` continue to render as full cards below the
books section, since there are typically fewer of them.

### Auto-collapse heuristic

- If only one book exists: default to expanded
- If 2+ books: all collapsed by default
- User can toggle each independently

### Files to change

| File | Change |
|---|---|
| `app/components/LibrarySelector.tsx` | Replace expanded grid with collapsible section + compact list |
| `app/api/chapters/route.ts` | Add aggregate stats (total concepts, total hours) to response |
| `lib/db.ts` | Extend `getPublicChaptersWithLibraries()` to compute aggregate stats |
