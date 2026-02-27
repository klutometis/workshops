#!/usr/bin/env tsx
/**
 * End-to-end script: URL in → processed library in DB out.
 *
 * Usage:
 *   npx tsx scripts/process-url.ts <url> [options]
 *
 * Options:
 *   --user <username>        GitHub username to own the library (default: none)
 *   --book <title>          Assign to a book (created if it doesn't exist)
 *   --chapter-order <n>     Position within the book
 *   --title <title>         Override the auto-detected title
 *   --public                Make the library public (default: private)
 *   --public-book           Also make the book public (default: private)
 *
 * Examples:
 *   npx tsx scripts/process-url.ts https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md
 *
 *   npx tsx scripts/process-url.ts \
 *     https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md \
 *     --user klutometis \
 *     --book "Paradigms of AI Programming" \
 *     --chapter-order 1 --public --public-book
 */

import pool, { createLibrary, createChapter, assignLibraryToChapter, getUserByUsername } from '../lib/db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { downloadFile, githubBlobToRaw, convertNotebookToMarkdown } from '../lib/processing';

// ============================================================================
// Argument parsing
// ============================================================================

interface Args {
  url: string;
  bookTitle?: string;
  chapterOrder?: number;
  title?: string;
  username?: string;
  isPublic: boolean;
  publicBook: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { isPublic: false, publicBook: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--book') {
      args.bookTitle = argv[++i];
    } else if (arg === '--chapter-order') {
      args.chapterOrder = parseInt(argv[++i], 10);
    } else if (arg === '--title') {
      args.title = argv[++i];
    } else if (arg === '--user') {
      args.username = argv[++i];
    } else if (arg === '--public') {
      args.isPublic = true;
    } else if (arg === '--public-book') {
      args.publicBook = true;
    } else if (!arg.startsWith('-') && !args.url) {
      args.url = arg;
    }
  }

  if (!args.url) {
    console.error(`
Usage: npx tsx scripts/process-url.ts <url> [options]

Options:
  --user <username>        GitHub username to own the library (default: none)
  --book <title>          Assign to a book (created if it doesn't exist)
  --chapter-order <n>     Position within the book
  --title <title>         Override the auto-detected title
  --public                Make the library public (default: private)
  --public-book           Also make the book public (default: private)

Examples:
  npx tsx scripts/process-url.ts https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md

  npx tsx scripts/process-url.ts \\
    https://github.com/norvig/paip-lisp/blob/main/docs/chapter1.md \\
    --user klutometis --book "Paradigms of AI Programming" \\
    --chapter-order 1 --public --public-book
`);
    process.exit(1);
  }

  return args as Args;
}

// ============================================================================
// Source type detection (same logic as publish API)
// ============================================================================

function detectSourceType(url: string): { type: 'youtube' | 'notebook' | 'markdown'; videoId?: string } | null {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return { type: 'youtube', videoId: youtubeMatch[1] };
  }
  if (url.endsWith('.ipynb')) {
    return { type: 'notebook' };
  }
  if (url.endsWith('.md')) {
    return { type: 'markdown' };
  }
  return null;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function extractTitleFromUrl(url: string): string {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  return decodeURIComponent(filename).replace(/\.(md|ipynb)$/, '').replace(/[-_]/g, ' ');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n🚀 process-url: End-to-End Library Processor`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`  URL:   ${args.url}`);
  if (args.username) console.log(`  User:  ${args.username}`);
  if (args.bookTitle) console.log(`  Book:  ${args.bookTitle}`);
  if (args.chapterOrder != null) console.log(`  Ch #:  ${args.chapterOrder}`);
  console.log();

  // 0. Resolve user if specified
  let userId: number | undefined;
  if (args.username) {
    const user = await getUserByUsername(args.username);
    if (!user) {
      console.error(`❌ User not found: ${args.username}`);
      await pool.end();
      process.exit(1);
    }
    userId = user.id;
    console.log(`👤 User: ${user.github_name || user.github_login} (id: ${user.id})`);
  }

  // 1. Detect source type
  const detected = detectSourceType(args.url);
  if (!detected) {
    console.error(`❌ Unsupported URL format. Must end in .md, .ipynb, or be a YouTube URL.`);
    process.exit(1);
  }
  console.log(`📄 Source type: ${detected.type}`);

  // 2. Extract metadata for title/slug (unless --title was given)
  let title: string;
  let extractedAuthor: string | undefined;
  let tempLibraryId: string | undefined;
  
  if (args.title) {
    title = args.title;
  } else if (detected.type !== 'youtube') {
    // Frontload metadata extraction to get a good slug
    console.log(`📋 Extracting metadata for title...`);
    tempLibraryId = crypto.randomUUID();
    const workDir = path.join('/tmp', 'markdown', tempLibraryId);
    fs.mkdirSync(workDir, { recursive: true });
    
    try {
      let markdownContent: string;
      let downloadUrl = args.url;
      if (downloadUrl.includes('github.com') && downloadUrl.includes('/blob/')) {
        downloadUrl = githubBlobToRaw(downloadUrl);
      }
      
      if (detected.type === 'notebook') {
        const urlParts = args.url.split('/');
        const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
        const notebookDir = path.join('/tmp', 'notebooks', tempLibraryId);
        fs.mkdirSync(notebookDir, { recursive: true });
        const notebookPath = path.join(notebookDir, fileName);
        await downloadFile(downloadUrl, notebookPath);
        const converted = convertNotebookToMarkdown(notebookPath);
        markdownContent = converted.cleaned;
      } else {
        const urlParts = args.url.split('/');
        const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
        const filePath = path.join(workDir, fileName);
        await downloadFile(downloadUrl, filePath);
        markdownContent = fs.readFileSync(filePath, 'utf-8');
      }
      
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
      if (apiKey) {
        const { extractMetadata } = await import('../lib/metadata-extractor');
        const metadata = await extractMetadata(markdownContent, args.url, apiKey);
        title = metadata.title;
        extractedAuthor = metadata.author || undefined;
        
        // Save so pipeline skips re-extraction
        fs.writeFileSync(
          path.join(workDir, 'extracted-metadata.json'),
          JSON.stringify(metadata, null, 2)
        );
        console.log(`📋 Title: "${title}", Author: ${extractedAuthor || 'unknown'}`);
      } else {
        // Fallback: # header or filename
        const headerMatch = markdownContent.match(/^#\s+(.+)$/m);
        title = headerMatch ? headerMatch[1].trim() : extractTitleFromUrl(args.url);
      }
    } catch (error) {
      console.warn(`⚠️  Metadata extraction failed, using filename:`, error);
      title = extractTitleFromUrl(args.url);
    }
  } else {
    title = extractTitleFromUrl(args.url);
  }
  
  const slug = generateSlug(title);

  // Check for existing library with same URL (re-import)
  const existing = await pool.query(
    'SELECT * FROM libraries WHERE source_url = $1',
    [args.url]
  );

  let library: any;
  let isReimport = false;

  if (existing.rows.length > 0) {
    library = existing.rows[0];
    isReimport = true;
    console.log(`🔄 Found existing library: ${library.id} (slug: ${library.slug}) — re-importing`);

    await pool.query(
      `UPDATE libraries
       SET status = 'pending',
           progress_message = NULL,
           error_message = NULL,
           processing_logs = '[]'::jsonb
       WHERE id = $1`,
      [library.id]
    );
  } else {
    library = await createLibrary({
      title,
      author: extractedAuthor || 'Unknown',
      type: detected.type,
      slug,
      source_url: args.url,
      video_id: detected.videoId,
      user_id: userId,
      is_public: args.isPublic,
      source_type: detected.type,
      metadata: {
        imported_via: 'process-url',
        imported_at: new Date().toISOString(),
      },
    });
    console.log(`📚 Created library: ${library.id} (slug: ${library.slug})`);
  }
  
  // Move pre-computed work dir to match the actual library ID
  if (tempLibraryId && tempLibraryId !== library.id) {
    const tempDir = path.join('/tmp', 'markdown', tempLibraryId);
    const realDir = path.join('/tmp', 'markdown', library.id);
    if (fs.existsSync(tempDir)) {
      if (fs.existsSync(realDir)) {
        fs.rmSync(realDir, { recursive: true });
      }
      fs.renameSync(tempDir, realDir);
    }
    const tempNotebookDir = path.join('/tmp', 'notebooks', tempLibraryId);
    const realNotebookDir = path.join('/tmp', 'notebooks', library.id);
    if (fs.existsSync(tempNotebookDir)) {
      if (fs.existsSync(realNotebookDir)) {
        fs.rmSync(realNotebookDir, { recursive: true });
      }
      fs.renameSync(tempNotebookDir, realNotebookDir);
    }
  }

  // 3. Optionally assign to a book
  if (args.bookTitle) {
    // Look up existing book by slug and owner
    const bookSlug = generateSlug(args.bookTitle);
    const existingBook = userId
      ? await pool.query(
          `SELECT * FROM chapters WHERE slug = $1 AND user_id = $2`,
          [bookSlug, userId]
        )
      : await pool.query(
          `SELECT * FROM chapters WHERE slug = $1 AND user_id IS NULL`,
          [bookSlug]
        );

    let book: any;
    if (existingBook.rows.length > 0) {
      book = existingBook.rows[0];
      console.log(`📖 Using existing book: "${book.title}" (${book.id})`);
      // Upgrade to public if requested and currently private
      if (args.publicBook && !book.is_public) {
        await pool.query('UPDATE chapters SET is_public = true WHERE id = $1', [book.id]);
        console.log(`   → Made book public`);
      }
    } else {
      book = await createChapter({
        title: args.bookTitle,
        slug: bookSlug,
        user_id: userId,
        is_public: args.publicBook,
      });
      console.log(`📖 Created book: "${book.title}" (${book.id})${args.publicBook ? ' (public)' : ''}`);
    }

    await assignLibraryToChapter(library.id, book.id, args.chapterOrder);
    console.log(`   → Assigned as chapter ${args.chapterOrder ?? '(unordered)'}`);
  }

  // 4. Run the processing pipeline (same as process-library.ts)
  console.log(`\n🔄 Starting processing pipeline...\n`);

  const startTime = Date.now();

  // Import the same processing functions used by process-library.ts
  const processing = await import('../lib/processing');

  try {
    // Set status to processing
    await pool.query(
      `UPDATE libraries SET status = 'processing', progress_message = 'Starting...' WHERE id = $1`,
      [library.id]
    );

    let result: any;

    const progressCb = async (stage: string, percent: number, message?: string) => {
      const msg = message || `${stage}: ${percent}%`;
      console.log(`  [${percent}%] ${msg}`);
      await pool.query(
        'UPDATE libraries SET progress_message = $1 WHERE id = $2',
        [msg, library.id]
      );
    };

    switch (detected.type) {
      case 'youtube':
        result = await processing.processYouTubeVideo(args.url, progressCb);
        break;
      case 'markdown':
        result = await processing.processMarkdownFile(args.url, library.id, progressCb);
        break;
      case 'notebook':
        result = await processing.processJupyterNotebook(args.url, library.id, progressCb, !isReimport);
        break;
    }

    // Update library with results
    const metadataUpdate: any = { stats: result.stats };
    if (result.extractedMetadata) {
      metadataUpdate.extracted = {
        topics: result.extractedMetadata.topics || [],
        level: result.extractedMetadata.level || null,
        estimated_hours: result.extractedMetadata.estimated_hours || null,
      };
    }

    await pool.query(
      `UPDATE libraries
       SET status = 'ready',
           progress_message = 'Processing complete!',
           processed_at = NOW(),
           title = $1,
           description = COALESCE(description, $2),
           author = COALESCE(author, $3),
           metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
       WHERE id = $5`,
      [
        result.title,
        result.extractedMetadata?.description || null,
        result.extractedMetadata?.author || null,
        JSON.stringify(metadataUpdate),
        library.id,
      ]
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Done in ${duration}s`);
    console.log();
    console.log(`  Library ID:  ${library.id}`);
    console.log(`  Slug:        ${library.slug}`);
    console.log(`  Title:       ${result.title}`);
    console.log(`  Concepts:    ${result.stats.conceptCount}`);
    console.log(`  Chunks:      ${result.stats.segmentCount}`);
    console.log(`  Embeddings:  ${result.stats.embeddingCount}`);
    if (args.username) console.log(`  Owner:       ${args.username}`);
    console.log(`  Public:      ${args.isPublic ? 'yes' : 'no'}`);
    if (args.bookTitle) {
      console.log(`  Book:        ${args.bookTitle}`);
      console.log(`  Chapter #:   ${args.chapterOrder ?? '(none)'}`);
    }
    console.log();

  } catch (error: any) {
    const errMsg = error.message || String(error);
    console.error(`\n❌ Processing failed: ${errMsg}`);
    if (error.stack) console.error(error.stack);

    await pool.query(
      'UPDATE libraries SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', errMsg, library.id]
    );

    await pool.end();
    process.exit(1);
  }

  await pool.end();
}

main();
