#!/usr/bin/env tsx
/**
 * Universal library processing script
 * 
 * Usage: npx tsx scripts/process-library.ts <library-id>
 * 
 * This script:
 * 1. Fetches library metadata from database
 * 2. Routes to appropriate processor (YouTube, markdown, notebook)
 * 3. Updates database status throughout processing
 * 4. Exits with code 0 (success) or 1 (failure)
 * 
 * Works identically in local dev and Cloud Run environments.
 */

import pool from '../lib/db';
import path from 'path';
import fs from 'fs/promises';

// Database logging helper - appends to processing_logs JSONB array
async function logToDatabase(
  libraryId: string,
  level: 'info' | 'error' | 'debug',
  stage: string,
  message: string
) {
  try {
    const logEntry = {
      ts: new Date().toISOString(),
      level,
      stage,
      msg: message.length > 2000 
        ? message.slice(0, 1000) + '\n...[truncated]...\n' + message.slice(-1000)
        : message
    };
    
    await pool.query(
      `UPDATE libraries 
       SET processing_logs = processing_logs || $1::jsonb 
       WHERE id = $2`,
      [JSON.stringify([logEntry]), libraryId]
    );
  } catch (error) {
    // Don't fail processing if logging fails
    console.error(`⚠️  Failed to log to database:`, error);
  }
}

// Progress update helper
async function updateProgress(libraryId: string, message: string, stage?: string) {
  console.log(`📝 ${message}`);
  try {
    // Update progress_message for UI
    await pool.query(
      'UPDATE libraries SET progress_message = $1 WHERE id = $2',
      [message, libraryId]
    );
    
    // Also log to processing_logs for debugging
    if (stage) {
      await logToDatabase(libraryId, 'info', stage, message);
    }
  } catch (error) {
    console.error(`⚠️  Failed to update progress: ${error}`);
  }
}

// Error handler
async function markFailed(libraryId: string, error: Error, stage?: string) {
  console.error(`❌ Processing failed:`, error);
  
  // Unwrap ProcessingError to get actual script failure details (stdout/stderr)
  const actualError = (error as any).originalError || error;
  
  // Log full error with all available details to database
  const errorDetails = [
    `Error: ${error.message}`,
    actualError.message !== error.message ? `\n\nUnderlying error:\n${actualError.message}` : '',
    actualError.stack ? `\n\nStack trace:\n${actualError.stack}` : '',
  ].filter(Boolean).join('');
  
  if (stage) {
    await logToDatabase(libraryId, 'error', stage, errorDetails);
  }
  
  await pool.query(
    'UPDATE libraries SET status = $1, error_message = $2 WHERE id = $3',
    ['failed', error.message, libraryId]
  );
}

// Main processing function
async function processLibrary(libraryId: string) {
  console.log(`\n🚀 LIBRARY PROCESSING`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📚 Library ID: ${libraryId}\n`);

  try {
    // 1. Fetch library from database
    const queryResult = await pool.query(
      'SELECT id, source_url, source_type, slug, title FROM libraries WHERE id = $1',
      [libraryId]
    );

    if (queryResult.rows.length === 0) {
      throw new Error(`Library not found: ${libraryId}`);
    }

    const library = queryResult.rows[0];
    console.log(`📖 Title: ${library.title}`);
    console.log(`🏷️  Slug: ${library.slug}`);
    console.log(`🔗 Source: ${library.source_url}`);
    console.log(`📄 Type: ${library.source_type}\n`);

    // 2. Clear logs and update status to processing (atomically prevents stale logs from previous runs)
    await pool.query(
      `UPDATE libraries 
       SET status = $1, 
           progress_message = $2, 
           processing_logs = '[]'::jsonb 
       WHERE id = $3`,
      ['processing', 'Initializing content processing...', libraryId]
    );
    
    await logToDatabase(libraryId, 'info', 'init', `Starting ${library.source_type} processing for: ${library.title}`);

    // 3. Route to appropriate processor and get result
    let result;
    switch (library.source_type) {
      case 'youtube':
        result = await processYouTube(libraryId, library.source_url, library.slug);
        break;

      case 'markdown':
        result = await processMarkdown(libraryId, library.source_url, library.slug);
        break;

      case 'notebook':
        result = await processNotebook(libraryId, library.source_url, library.slug);
        break;

      default:
        throw new Error(`Unsupported source type: ${library.source_type}`);
    }

    // 4. Update library with final results (title, stats)
    // Note: slug is set at creation time and should not be changed
    await pool.query(
      `UPDATE libraries 
       SET status = $1, 
           progress_message = $2, 
           processed_at = NOW(),
           title = $3,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{stats}',
             $4::jsonb
           )
       WHERE id = $5`,
      [
        'ready',
        'Processing complete! Library is ready to use.',
        result.title,
        JSON.stringify(result.stats),
        libraryId
      ]
    );

    console.log(`\n✅ Library processed successfully: ${library.slug}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(0);

  } catch (error) {
    const err = error as Error;
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error('Stack:', err.stack);
    
    await markFailed(libraryId, err, 'fatal');
    await pool.end();
    process.exit(1);
  }
  
  // Close pool after successful completion
  await pool.end();
}

// YouTube processing pipeline
async function processYouTube(libraryId: string, sourceUrl: string, slug: string) {
  const videoId = extractYouTubeId(sourceUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  console.log(`🎬 Processing YouTube video: ${videoId}\n`);

  // Import the existing YouTube processing modules
  const { processYouTubeVideo } = await import('../lib/processing');

  // Run the full YouTube pipeline with progress callback
  const result = await processYouTubeVideo(sourceUrl, async (stage, percent, message) => {
    const progressMsg = message || `${stage}: ${percent}%`;
    await updateProgress(libraryId, progressMsg, stage);
  });
  
  return result;
}

// Markdown processing pipeline
async function processMarkdown(libraryId: string, sourceUrl: string, slug: string) {
  console.log(`📄 Processing markdown: ${sourceUrl}\n`);

  const { processMarkdownFile } = await import('../lib/processing');

  // Run the markdown pipeline with progress callback
  const result = await processMarkdownFile(sourceUrl, libraryId, async (stage, percent, message) => {
    const progressMsg = message || `${stage}: ${percent}%`;
    await updateProgress(libraryId, progressMsg, stage);
  });
  
  return result;
}

// Notebook processing pipeline
async function processNotebook(libraryId: string, sourceUrl: string, slug: string) {
  console.log(`📓 Processing Jupyter notebook: ${sourceUrl}\n`);

  const { processJupyterNotebook } = await import('../lib/processing');

  // Run the notebook pipeline (converts to markdown internally) with progress callback
  const result = await processJupyterNotebook(sourceUrl, libraryId, async (stage, percent, message) => {
    const progressMsg = message || `${stage}: ${percent}%`;
    await updateProgress(libraryId, progressMsg, stage);
  });
  
  return result;
}

// Helper: Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// CLI entry point
const libraryId = process.argv[2];

if (!libraryId) {
  console.error('❌ Error: Library ID required\n');
  console.error('Usage: npx tsx scripts/process-library.ts <library-id>\n');
  console.error('Example: npx tsx scripts/process-library.ts 88b2316d-16e1-491f-bc2c-8613b8839b77');
  process.exit(1);
}

// Validate UUID format
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidPattern.test(libraryId)) {
  console.error(`❌ Error: Invalid library ID format: ${libraryId}`);
  console.error('Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  process.exit(1);
}

// Run the processor
processLibrary(libraryId);
