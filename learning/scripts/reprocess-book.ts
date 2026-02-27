#!/usr/bin/env tsx
/**
 * Reprocess all (or specific) chapters in a book.
 *
 * Looks up the book by title in the DB, finds all its libraries,
 * nukes their /tmp/markdown/<id>/ work dirs, and re-runs
 * process-url.ts for each one.
 *
 * Usage:
 *   npx tsx scripts/reprocess-book.ts --book "Paradigms of Artificial Intelligence Programming"
 *   npx tsx scripts/reprocess-book.ts --book "Paradigms of..." --chapters 4,7,19,24
 *   npx tsx scripts/reprocess-book.ts --book "Paradigms of..." --parallel 3
 */

import pool from '../lib/db';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface Args {
  bookTitle: string;
  chapters?: number[];
  parallel: number;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { parallel: 3 };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--book') {
      args.bookTitle = argv[++i];
    } else if (arg === '--chapters') {
      args.chapters = argv[++i].split(',').map(n => parseInt(n, 10));
    } else if (arg === '--parallel') {
      args.parallel = parseInt(argv[++i], 10);
    }
  }

  if (!args.bookTitle) {
    console.error(`
Usage: npx tsx scripts/reprocess-book.ts --book <title> [options]

Options:
  --book <title>        Book title (required, matched with ILIKE)
  --chapters <n,n,...>  Only reprocess specific chapter numbers
  --parallel <n>        Max parallel jobs (default: 3)

Examples:
  npx tsx scripts/reprocess-book.ts --book "Paradigms of Artificial Intelligence Programming"
  npx tsx scripts/reprocess-book.ts --book "Paradigms of%" --chapters 4,7,19,24 --parallel 2
`);
    process.exit(1);
  }

  return args as Args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n📖 Reprocess Book`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. Find the book
  const bookResult = await pool.query(
    `SELECT * FROM chapters WHERE title ILIKE $1`,
    [args.bookTitle]
  );

  if (bookResult.rows.length === 0) {
    console.error(`❌ No book found matching: "${args.bookTitle}"`);
    await pool.end();
    process.exit(1);
  }

  if (bookResult.rows.length > 1) {
    console.error(`❌ Multiple books match "${args.bookTitle}":`);
    for (const b of bookResult.rows) {
      console.error(`   - ${b.title} (${b.id})`);
    }
    console.error(`\nBe more specific.`);
    await pool.end();
    process.exit(1);
  }

  const book = bookResult.rows[0];
  console.log(`  Book:  ${book.title}`);
  console.log(`  ID:    ${book.id}`);

  // 2. Find all libraries in the book
  const libsResult = await pool.query(
    `SELECT l.id, l.source_url, l.chapter_order, l.is_public, l.title, l.source_type,
            u.github_login as username
     FROM libraries l
     LEFT JOIN users u ON l.user_id = u.id
     WHERE l.chapter_id = $1
     ORDER BY l.chapter_order ASC NULLS LAST`,
    [book.id]
  );

  let libraries = libsResult.rows;

  if (libraries.length === 0) {
    console.log(`\n  No libraries found in this book.`);
    await pool.end();
    return;
  }

  // 3. Filter to specific chapters if requested
  if (args.chapters) {
    libraries = libraries.filter((lib: any) => args.chapters!.includes(lib.chapter_order));
  }

  console.log(`  Chapters: ${libraries.length} to reprocess`);
  if (args.chapters) {
    console.log(`  Filter:  chapters ${args.chapters.join(', ')}`);
  }
  console.log(`  Parallel: ${args.parallel}`);
  console.log();

  // Show what we're about to do
  for (const lib of libraries) {
    console.log(`  ${String(lib.chapter_order).padStart(2)}.  ${lib.title}`);
  }
  console.log();

  // 4. Nuke work dirs
  let nuked = 0;
  for (const lib of libraries) {
    const workDir = path.join('/tmp', 'markdown', lib.id);
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
      nuked++;
    }
    // Also clean notebook dir if it exists
    const notebookDir = path.join('/tmp', 'notebooks', lib.id);
    if (fs.existsSync(notebookDir)) {
      fs.rmSync(notebookDir, { recursive: true });
    }
  }
  console.log(`🗑️  Cleaned ${nuked} work directories\n`);

  // 5. Close our DB connection before spawning children (they make their own)
  await pool.end();

  // 6. Run process-url.ts for each, with parallelism
  const startTime = Date.now();
  const results: { chapter: number; title: string; success: boolean }[] = [];
  let running = 0;
  let index = 0;

  await new Promise<void>((resolve) => {
    function launchNext() {
      while (running < args.parallel && index < libraries.length) {
        const lib = libraries[index++];
        running++;

        const cmdArgs = [
          'tsx', 'scripts/process-url.ts',
          lib.source_url,
          '--user', lib.username,
          '--book', book.title,
          '--chapter-order', String(lib.chapter_order),
        ];
        if (lib.is_public) cmdArgs.push('--public');

        console.log(`🚀 Starting chapter ${lib.chapter_order}: ${lib.title}`);

        const child = spawn('npx', cmdArgs, {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit',
          env: process.env,
        });

        child.on('close', (code) => {
          const success = code === 0;
          results.push({
            chapter: lib.chapter_order,
            title: lib.title,
            success,
          });

          if (success) {
            console.log(`\n✅ Chapter ${lib.chapter_order} done\n`);
          } else {
            console.log(`\n❌ Chapter ${lib.chapter_order} failed (exit ${code})\n`);
          }

          running--;
          launchNext();

          if (running === 0 && index >= libraries.length) {
            resolve();
          }
        });
      }

      if (running === 0 && index >= libraries.length) {
        resolve();
      }
    }

    launchNext();
  });

  // 7. Summary
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📖 Reprocess complete: ${succeeded}/${results.length} chapters in ${duration}min`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed chapters:`);
    for (const f of failed) {
      console.log(`   ${f.chapter}. ${f.title}`);
    }
  }

  console.log();
}

main();
