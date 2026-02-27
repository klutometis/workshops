#!/usr/bin/env tsx
/**
 * Batch import all Pytudes notebooks grouped by Peter's README taxonomy.
 *
 * Books are processed sequentially; notebooks within each book are processed
 * in parallel (--parallel, default 3). "New" is processed last so that
 * duplicate notebooks (which appear in both topical books and "New") end up
 * assigned to "New".
 *
 * Usage:
 *   npx tsx scripts/import-pytudes.ts
 *   npx tsx scripts/import-pytudes.ts --parallel 2
 *   npx tsx scripts/import-pytudes.ts --user klutometis --parallel 3
 */

import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// Config
// ============================================================================

const BASE_URL = 'https://github.com/norvig/pytudes/blob/main/ipynb';
const DEFAULT_USER = 'klutometis';
const DEFAULT_PARALLEL = 3;

interface Book {
  title: string;
  notebooks: string[]; // filenames as they appear in the ipynb/ directory
}

// "New" is last so it wins for cross-category duplicates
const PYTUDES_BOOKS: Book[] = [
  {
    title: 'Pytudes: Programming Examples',
    notebooks: [
      'AlphaCode.ipynb',
      'Babylonian digits.ipynb',
      'Beal.ipynb',
      'Bike-Stats.ipynb',
      'Cant-Stop.ipynb',
      'Sierpinski.ipynb',
      'Life.ipynb',
      'Maze.ipynb',
      'Triplets.ipynb',
      'Konane.ipynb',
      'PhotoFocalLengths.ipynb',
      'Pickleball.ipynb',
      'Project Euler Utils.ipynb',
      'Menu.ipynb',
      'Electoral Votes.ipynb',
    ],
  },
  {
    title: 'Pytudes: Advent of Code',
    notebooks: [
      'Advent-2025-AI.ipynb',
      'Advent-2025.ipynb',
      'Advent-2024.ipynb',
      'Advent-2023.ipynb',
      'Advent-2022.ipynb',
      'Advent-2021.ipynb',
      'Advent-2020.ipynb',
      'Advent-2018.ipynb',
      'Advent-2017.ipynb',
      'Advent-2016.ipynb',
      'AdventUtils.ipynb',
    ],
  },
  {
    title: 'Pytudes: Probability and Uncertainty',
    notebooks: [
      'Goldberg.ipynb',
      'Probability.ipynb',
      'ProbabilityParadox.ipynb',
      'ProbabilitySimulation.ipynb',
      'Diamonds.ipynb',
      'Coin Flip.ipynb',
      'Dice Baseball.ipynb',
      'Economics.ipynb',
      'Overtime.ipynb',
      'poker.ipynb',
      'risk.ipynb',
      'WWW.ipynb',
    ],
  },
  {
    title: 'Pytudes: Logic and Number Puzzles',
    notebooks: [
      'Paint.ipynb',
      'Cryptarithmetic.ipynb',
      "Euler's Conjecture.ipynb",
      'Countdown.ipynb',
      'How To Count Things.ipynb',
      'KenKen.ipynb',
      'NumberBracelets.ipynb',
      'Socks.ipynb',
      'Sicherman Dice.ipynb',
      'Golomb-Puzzle.ipynb',
      'Stubborn.ipynb',
      'StarBattle.ipynb',
      'Sudoku.ipynb',
      'SudokuJava.ipynb',
      'SquareSum.ipynb',
      'Cheryl.ipynb',
      'Cheryl-and-Eve.ipynb',
      'CherylMind.ipynb',
      'xkcd1313.ipynb',
      'xkcd1313-part2.ipynb',
    ],
  },
  {
    title: 'Pytudes: Word Puzzles',
    notebooks: [
      'Boggle.ipynb',
      'ElementSpelling.ipynb',
      'equilength-numbers.ipynb',
      'Gesture Typing.ipynb',
      'Ghost.ipynb',
      'How to Do Things with Words.ipynb',
      'Fred Buns.ipynb',
      'OneLetterOff.ipynb',
      'Scrabble.ipynb',
      'SpellingBee.ipynb',
      'PropositionalLogic.ipynb',
      'Jotto.ipynb',
      'Wordle.ipynb',
      'pal3.ipynb',
      'Portmantout.ipynb',
      'xkcd-Name-Dominoes.ipynb',
    ],
  },
  {
    title: 'Pytudes: The Riddler',
    notebooks: [
      'Anigrams.ipynb',
      'Riddler Battle Royale.ipynb',
      'ClimbingWall.ipynb',
      'CrossProduct.ipynb',
      'flipping.ipynb',
      'RiddlerLottery.ipynb',
      'NightKing.ipynb',
      'Mean Misanthrope Density.ipynb',
      'Orderable Cards.ipynb',
      'RaceTrack.ipynb',
      'SplitStates.ipynb',
      'TourDe538.ipynb',
      'TwelveBalls.ipynb',
      'war.ipynb',
    ],
  },
  {
    title: 'Pytudes: Computer Science Algorithms',
    notebooks: [
      'BASIC.ipynb',
      'Convex Hull.ipynb',
      'DocstringFixpoint.ipynb',
      'StableMatching.ipynb',
      'Differentiation.ipynb',
      'Snobol.ipynb',
      'TSP.ipynb',
      'TruncatablePrimes.ipynb',
    ],
  },
  // "New" last — wins for any cross-category duplicates
  {
    title: 'Pytudes: New',
    notebooks: [
      'TruncatablePrimes.ipynb',
      'Advent-2025.ipynb',
      'Advent-2025-AI.ipynb',
      'Advent-2024.ipynb',
      'Paint.ipynb',
      'CherylMind.ipynb',
      'NumberBracelets.ipynb',
      'Overtime.ipynb',
      'Stubborn.ipynb',
      'Triplets.ipynb',
    ],
  },
];

// ============================================================================
// Arg parsing
// ============================================================================

function parseArgs(argv: string[]): { user: string; parallel: number } {
  const args = { user: DEFAULT_USER, parallel: DEFAULT_PARALLEL };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user') args.user = argv[++i];
    else if (argv[i] === '--parallel') args.parallel = parseInt(argv[++i], 10);
  }
  return args;
}

// ============================================================================
// Spawn helper
// ============================================================================

function runProcessUrl(
  notebookFile: string,
  bookTitle: string,
  chapterOrder: number,
  user: string
): Promise<{ file: string; success: boolean }> {
  const url = `${BASE_URL}/${encodeURIComponent(notebookFile)}`;

  const cmdArgs = [
    'tsx',
    'scripts/process-url.ts',
    url,
    '--user', user,
    '--book', bookTitle,
    '--chapter-order', String(chapterOrder),
    '--public',
    '--public-book',
  ];

  return new Promise((resolve) => {
    const child = spawn('npx', cmdArgs, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      resolve({ file: notebookFile, success: code === 0 });
    });
  });
}

// ============================================================================
// Process one book with internal parallelism
// ============================================================================

async function processBook(book: Book, user: string, parallel: number) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📚 Book: ${book.title}`);
  console.log(`   ${book.notebooks.length} notebooks, parallel=${parallel}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results: { file: string; success: boolean }[] = [];
  let index = 0;
  let running = 0;

  await new Promise<void>((resolve) => {
    function launchNext() {
      while (running < parallel && index < book.notebooks.length) {
        const notebook = book.notebooks[index];
        const order = index + 1;
        index++;
        running++;

        console.log(`  → [${order}/${book.notebooks.length}] ${notebook}`);

        runProcessUrl(notebook, book.title, order, user).then((result) => {
          results.push(result);
          running--;
          if (result.success) {
            console.log(`  ✅ Done: ${result.file}`);
          } else {
            console.log(`  ❌ Failed: ${result.file}`);
          }
          launchNext();
          if (running === 0 && index >= book.notebooks.length) resolve();
        });
      }
      if (running === 0 && index >= book.notebooks.length) resolve();
    }
    launchNext();
  });

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  console.log(`\n  ${book.title}: ${succeeded}/${book.notebooks.length} succeeded`);
  if (failed.length > 0) {
    console.log(`  Failed:`);
    for (const f of failed) console.log(`    - ${f.file}`);
  }

  return results;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const totalNotebooks = PYTUDES_BOOKS.reduce((n, b) => n + b.notebooks.length, 0);

  console.log(`\n🐍 Pytudes Batch Importer`);
  console.log(`${'━'.repeat(60)}`);
  console.log(`  User:        ${args.user}`);
  console.log(`  Books:       ${PYTUDES_BOOKS.length}`);
  console.log(`  Notebooks:   ${totalNotebooks} entries (incl. cross-category duplicates)`);
  console.log(`  Parallel:    ${args.parallel} per book`);
  console.log(`  Est. time:   ${Math.round(totalNotebooks / args.parallel * 4 / 60)}–${Math.round(totalNotebooks / args.parallel * 6 / 60)} hours`);
  console.log(`${'━'.repeat(60)}\n`);

  const startTime = Date.now();
  const allResults: { book: string; file: string; success: boolean }[] = [];

  for (const book of PYTUDES_BOOKS) {
    const results = await processBook(book, args.user, args.parallel);
    for (const r of results) allResults.push({ book: book.title, ...r });
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const succeeded = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success);

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`🐍 Pytudes import complete: ${succeeded}/${allResults.length} in ${duration}min`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed (${failed.length}):`);
    for (const f of failed) console.log(`   [${f.book}] ${f.file}`);
  }

  console.log();
}

main();
