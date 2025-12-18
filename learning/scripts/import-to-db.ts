#!/usr/bin/env tsx
/**
 * Unified import script for all content types to PostgreSQL database
 * 
 * Supports:
 * - Markdown files (--type markdown)
 * - Jupyter notebooks (--type notebook)
 * - YouTube videos (--type youtube) [future]
 * 
 * Usage:
 *   # Markdown
 *   npx tsx scripts/import-to-db.ts --type markdown --markdown-path <file>
 *   
 *   # Notebook
 *   npx tsx scripts/import-to-db.ts --type notebook --notebook-path <file> --markdown-path <file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import type { ConceptGraph } from './youtube/types.js';

// ============================================================================
// Types (matching our JSON file structures)
// ============================================================================

interface MappedChunk {
  chunk_id: string;
  title?: string;
  content: string;
  type?: string;
  section?: string;
  start_line?: number;
  end_line?: number;
  concept_mapping: {
    chunk_id: string;
    concept_id: string;
    confidence: number;
    secondary_concepts?: string[];
    reasoning?: string;
  };
}

interface EmbeddedChunk extends MappedChunk {
  embedding: number[];
  embedding_model: string;
  embedding_text: string;
}

interface ChunkEmbeddings {
  source_file: string;
  chunks: EmbeddedChunk[];
  metadata: {
    total_embeddings: number;
    embedded_at: string;
    embedding_model: string;
    embedding_dimensions: number;
  };
}

interface ImportArgs {
  type: 'markdown' | 'notebook' | 'youtube';
  libraryId: string;
  markdownPath?: string;
  notebookPath?: string;
  videoId?: string;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): ImportArgs {
  const args: any = {};
  
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--type') {
      args.type = argv[++i];
    } else if (argv[i] === '--library-id') {
      args.libraryId = argv[++i];
    } else if (argv[i] === '--markdown-path') {
      args.markdownPath = argv[++i];
    } else if (argv[i] === '--notebook-path') {
      args.notebookPath = argv[++i];
    } else if (argv[i] === '--video-id') {
      args.videoId = argv[++i];
    }
  }
  
  return args as ImportArgs;
}

// ============================================================================
// Title Extraction
// ============================================================================

/**
 * Extract title from markdown file (first # header)
 */
function extractMarkdownTitle(markdownPath: string): string | null {
  try {
    const content = fs.readFileSync(markdownPath, 'utf-8');
    
    // Match first # header (not ##, ###, etc.)
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Slug Generation
// ============================================================================

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')       // Trim leading/trailing hyphens
    .substring(0, 100);             // Limit length
}

// ============================================================================
// Database Connection
// ============================================================================

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL || process.env.LEARNING_DATABASE_URL_PROXY;
  
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or LEARNING_DATABASE_URL_PROXY environment variable not set\n' +
      'Example: DATABASE_URL="postgresql://postgres:password@localhost:5432/learning"'
    );
  }
  
  return new Pool({ connectionString });
}

// ============================================================================
// Import Library (Type-Specific)
// ============================================================================

async function importMarkdownLibrary(
  pool: Pool,
  libraryId: string,
  conceptGraph: ConceptGraph,
  markdownPath: string,
  basename: string
): Promise<void> {
  console.log(`📚 Updating markdown library: ${libraryId}...`);
  
  const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
  console.log(`   Read ${markdownContent.length} chars of markdown content`);
  
  // Extract title: AI metadata > first markdown header > basename
  const markdownTitle = extractMarkdownTitle(markdownPath);
  const title = conceptGraph.metadata?.title || markdownTitle || basename;
  console.log(`   Title: ${title}`);
  
  await pool.query(
    `UPDATE libraries 
     SET title = $1,
         author = $2,
         markdown_content = $3,
         source_type = $4,
         total_concepts = $5,
         status = $6,
         processed_at = $7
     WHERE id = $8`,
    [
      title,
      conceptGraph.metadata?.author || 'Unknown',
      markdownContent,
      'markdown',
      conceptGraph.nodes?.length || 0,
      'ready',
      conceptGraph.metadata?.enriched_at || conceptGraph.metadata?.extracted_at || new Date().toISOString(),
      libraryId,
    ]
  );
  
  console.log(`   ✓ Library updated`);
  console.log(`   ✓ Source type: markdown\n`);
}

async function importNotebookLibrary(
  pool: Pool,
  libraryId: string,
  conceptGraph: ConceptGraph,
  markdownPath: string,
  notebookPath: string,
  basename: string
): Promise<void> {
  console.log(`📚 Updating notebook library: ${libraryId}...`);
  
  const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
  console.log(`   Read ${markdownContent.length} chars of markdown content`);
  
  const notebookData = JSON.parse(fs.readFileSync(notebookPath, 'utf-8'));
  console.log(`   Read original notebook: ${notebookPath}`);
  
  // Extract title: AI metadata > first markdown header > basename
  const markdownTitle = extractMarkdownTitle(markdownPath);
  const title = conceptGraph.metadata?.title || markdownTitle || basename;
  console.log(`   Title: ${title}`);
  
  await pool.query(
    `UPDATE libraries 
     SET title = $1,
         author = $2,
         markdown_content = $3,
         source_type = $4,
         notebook_data = $5,
         total_concepts = $6,
         status = $7,
         processed_at = $8
     WHERE id = $9`,
    [
      title,
      conceptGraph.metadata?.author || 'Unknown',
      markdownContent,
      'notebook',
      JSON.stringify(notebookData),
      conceptGraph.nodes?.length || 0,
      'ready',
      conceptGraph.metadata?.enriched_at || conceptGraph.metadata?.extracted_at || new Date().toISOString(),
      libraryId,
    ]
  );
  
  console.log(`   ✓ Library updated`);
  console.log(`   ✓ Source type: notebook`);
  console.log(`   ✓ Notebook data stored (${JSON.stringify(notebookData).length} bytes)\n`);
}

// ============================================================================
// Shared Import Functions
// ============================================================================

async function importConcepts(
  pool: Pool,
  libraryId: string,
  conceptGraph: ConceptGraph
): Promise<void> {
  console.log(`🎓 Importing ${conceptGraph.nodes?.length || 0} concepts...`);
  
  await pool.query('DELETE FROM concepts WHERE library_id = $1', [libraryId]);
  
  for (const node of conceptGraph.nodes || []) {
    await pool.query(
      `INSERT INTO concepts (
        library_id, concept_id, name, description, difficulty,
        learning_objectives, common_misconceptions, mastery_indicators
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        libraryId,
        node.id,
        node.name,
        node.description,
        node.difficulty || 'intermediate',
        JSON.stringify(node.learning_objectives || []),
        JSON.stringify(node.common_misconceptions || []),
        JSON.stringify(node.mastery_indicators || []),
      ]
    );
  }
  
  console.log(`   ✓ Concepts imported\n`);
}

async function importPrerequisites(
  pool: Pool,
  libraryId: string,
  conceptGraph: ConceptGraph
): Promise<void> {
  console.log(`🔗 Importing prerequisites...`);
  
  await pool.query('DELETE FROM prerequisites WHERE library_id = $1', [libraryId]);
  
  const validConceptIds = new Set(
    (conceptGraph.nodes || []).map(node => node.id)
  );
  
  let totalPrereqs = 0;
  let skippedPrereqs = 0;
  
  if (conceptGraph.edges && conceptGraph.edges.length > 0) {
    for (const edge of conceptGraph.edges) {
      const fromId = edge.from;
      const toId = edge.to;
      
      if (!validConceptIds.has(fromId)) {
        console.log(`   ⚠️  Skipping edge: ${fromId} -> ${toId} (from concept not found)`);
        skippedPrereqs++;
        continue;
      }
      if (!validConceptIds.has(toId)) {
        console.log(`   ⚠️  Skipping edge: ${fromId} -> ${toId} (to concept not found)`);
        skippedPrereqs++;
        continue;
      }
      
      await pool.query(
        `INSERT INTO prerequisites (library_id, from_concept_id, to_concept_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (library_id, from_concept_id, to_concept_id) DO NOTHING`,
        [libraryId, fromId, toId]
      );
      totalPrereqs++;
    }
  } else if (conceptGraph.nodes) {
    for (const node of conceptGraph.nodes) {
      for (const prereqId of node.prerequisites || []) {
        if (!validConceptIds.has(prereqId)) {
          console.log(`   ⚠️  Skipping prerequisite: ${prereqId} -> ${node.id} (prerequisite concept not found)`);
          skippedPrereqs++;
          continue;
        }
        
        await pool.query(
          `INSERT INTO prerequisites (library_id, from_concept_id, to_concept_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (library_id, from_concept_id, to_concept_id) DO NOTHING`,
          [libraryId, prereqId, node.id]
        );
        totalPrereqs++;
      }
    }
  }
  
  console.log(`   ✓ ${totalPrereqs} prerequisite edges imported${skippedPrereqs > 0 ? ` (${skippedPrereqs} skipped)` : ''}\n`);
}

async function importTextChunks(
  pool: Pool,
  libraryId: string,
  chunksData: ChunkEmbeddings
): Promise<Map<string, string>> {
  console.log(`📝 Importing ${chunksData.chunks?.length || 0} text chunks...`);
  
  await pool.query('DELETE FROM text_chunks WHERE library_id = $1', [libraryId]);
  
  const chunkIdToDbId = new Map<string, string>();
  
  for (let i = 0; i < (chunksData.chunks || []).length; i++) {
    const chunk = chunksData.chunks[i];
    
    const result = await pool.query(
      `INSERT INTO text_chunks (
        library_id, chunk_index, chunk_id, content, title, type,
        section, start_line, end_line,
        mapped_concept_id, mapping_confidence, secondary_concepts, mapping_reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        libraryId,
        i,
        chunk.chunk_id,
        chunk.content || chunk.embedding_text,
        chunk.title || null,
        chunk.type || null,
        chunk.section || null,
        chunk.start_line || null,
        chunk.end_line || null,
        chunk.concept_mapping?.concept_id || null,
        chunk.concept_mapping?.confidence || null,
        JSON.stringify(chunk.concept_mapping?.secondary_concepts || []),
        chunk.concept_mapping?.reasoning || null,
      ]
    );
    
    chunkIdToDbId.set(chunk.chunk_id, result.rows[0].id);
  }
  
  console.log(`   ✓ Text chunks imported\n`);
  
  return chunkIdToDbId;
}

async function importEmbeddings(
  pool: Pool,
  libraryId: string,
  chunksData: ChunkEmbeddings,
  chunkIdToDbId: Map<string, string>
): Promise<void> {
  console.log(`🔢 Importing ${chunksData.chunks?.length || 0} embeddings...`);
  
  await pool.query('DELETE FROM embeddings WHERE library_id = $1', [libraryId]);
  
  let imported = 0;
  let skipped = 0;
  
  for (const chunk of chunksData.chunks || []) {
    const textChunkId = chunkIdToDbId.get(chunk.chunk_id);
    
    if (!textChunkId) {
      console.log(`   ⚠️  Skipping embedding for chunk ${chunk.chunk_id} (text chunk not found)`);
      skipped++;
      continue;
    }
    
    const vectorString = `[${chunk.embedding.join(',')}]`;
    
    await pool.query(
      `INSERT INTO embeddings (
        library_id, text_chunk_id, embedding, embedding_model, embedding_text
      ) VALUES ($1, $2, $3::vector, $4, $5)`,
      [
        libraryId,
        textChunkId,
        vectorString,
        chunk.embedding_model,
        chunk.embedding_text,
      ]
    );
    
    imported++;
  }
  
  console.log(`   ✓ ${imported} embeddings imported${skipped > 0 ? ` (${skipped} skipped)` : ''}\n`);
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function importToDb(args: ImportArgs): Promise<void> {
  // Validate arguments
  if (!args.libraryId) {
    throw new Error('--library-id is required');
  }
  if (args.type === 'markdown' && !args.markdownPath) {
    throw new Error('--markdown-path is required for markdown import');
  }
  if (args.type === 'notebook' && (!args.notebookPath || !args.markdownPath)) {
    throw new Error('--notebook-path and --markdown-path are required for notebook import');
  }
  
  console.log(`\n${args.type === 'notebook' ? '📓' : '📝'} ${args.type.toUpperCase()} Import to Database`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (args.type === 'notebook') {
    console.log(`📄 Notebook file: ${args.notebookPath}`);
    console.log(`📄 Markdown file: ${args.markdownPath}\n`);
  } else {
    console.log(`📄 Markdown file: ${args.markdownPath}\n`);
  }
  
  // Setup paths
  const markdownPath = args.markdownPath!;
  const workDir = path.dirname(markdownPath);
  const basename = path.basename(workDir);
  
  const conceptGraphPath = path.join(workDir, 'concept-graph-enriched.json');
  const chunksPath = path.join(workDir, 'chunk-embeddings.json');
  
  // Check inputs exist
  console.log(`📂 Loading files...\n`);
  
  const files = [
    { path: conceptGraphPath, name: 'concept-graph-enriched.json' },
    { path: chunksPath, name: 'chunk-embeddings.json' },
  ];
  
  if (args.type === 'notebook') {
    files.unshift({ path: args.notebookPath!, name: 'notebook (.ipynb)' });
  }
  
  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`❌ Missing file: ${file.path}`);
    }
    console.log(`   ✓ Found ${file.name}`);
  }
  console.log();
  
  // Load data
  const conceptGraph: ConceptGraph = JSON.parse(fs.readFileSync(conceptGraphPath, 'utf-8'));
  const chunksData: ChunkEmbeddings = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
  
  console.log(`📊 Data Summary:`);
  console.log(`   Title: ${conceptGraph.metadata?.title || basename}`);
  console.log(`   Author: ${conceptGraph.metadata?.author || 'Unknown'}`);
  console.log(`   Concepts: ${conceptGraph.nodes?.length || 0}`);
  console.log(`   Prerequisites: ${conceptGraph.edges?.length || 0}`);
  console.log(`   Chunks: ${chunksData.chunks?.length || 0}`);
  console.log(`   Embedding dimensions: ${chunksData.metadata?.embedding_dimensions || 0}\n`);
  
  // Connect to database
  const pool = createPool();
  
  try {
    console.log(`🔄 Starting database transaction...\n`);
    await pool.query('BEGIN');
    
    // Import library (type-specific)
    if (args.type === 'markdown') {
      await importMarkdownLibrary(pool, args.libraryId, conceptGraph, markdownPath, basename);
    } else if (args.type === 'notebook') {
      await importNotebookLibrary(pool, args.libraryId, conceptGraph, markdownPath, args.notebookPath!, basename);
    } else {
      throw new Error(`Unsupported type: ${args.type}`);
    }
    
    const libraryId = args.libraryId;
    
    // Shared imports
    await importConcepts(pool, libraryId, conceptGraph);
    await importPrerequisites(pool, libraryId, conceptGraph);
    const chunkIdToDbId = await importTextChunks(pool, libraryId, chunksData);
    await importEmbeddings(pool, libraryId, chunksData, chunkIdToDbId);
    
    await pool.query('COMMIT');
    console.log(`✅ Transaction committed successfully!\n`);
    
    // Verification
    console.log(`🔍 Verification:`);
    
    const counts = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM concepts WHERE library_id = $1) as concepts,
        (SELECT COUNT(*) FROM prerequisites WHERE library_id = $1) as prerequisites,
        (SELECT COUNT(*) FROM text_chunks WHERE library_id = $1) as text_chunks,
        (SELECT COUNT(*) FROM embeddings WHERE library_id = $1) as embeddings`,
      [libraryId]
    );
    
    console.log(`   Concepts: ${counts.rows[0].concepts}`);
    console.log(`   Prerequisites: ${counts.rows[0].prerequisites}`);
    console.log(`   Text Chunks: ${counts.rows[0].text_chunks}`);
    console.log(`   Embeddings: ${counts.rows[0].embeddings}`);
    
    if (args.type === 'notebook') {
      const libraryCheck = await pool.query(
        `SELECT source_type, notebook_data IS NOT NULL as has_notebook_data
         FROM libraries WHERE id = $1`,
        [libraryId]
      );
      console.log(`   Source Type: ${libraryCheck.rows[0].source_type}`);
      console.log(`   Notebook Data: ${libraryCheck.rows[0].has_notebook_data ? 'Stored ✓' : 'Missing ✗'}`);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ Import Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`🎉 ${conceptGraph.metadata?.title || basename} successfully imported!`);
    console.log(`📚 Library ID: ${libraryId}`);
    console.log(`📍 Source Type: ${args.type}\n`);
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(`\n❌ Import failed! Transaction rolled back.`);
    throw error;
  } finally {
    await pool.end();
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

const args = parseArgs(process.argv.slice(2));

if (!args.type || args.type === '--help' || args.type === '-h') {
  console.log(`
Usage: tsx scripts/import-to-db.ts --library-id <id> --type <type> [options]

Import content to PostgreSQL database.

Types:
  markdown    Import markdown file
  notebook    Import Jupyter notebook

Options:
  --library-id <uuid>       Library ID to update (required)
  --markdown-path <path>    Path to markdown file (required for markdown & notebook)
  --notebook-path <path>    Path to .ipynb file (required for notebook)

Environment Variables:
  DATABASE_URL or LEARNING_DATABASE_URL_PROXY
    PostgreSQL connection string

Examples:
  # Import markdown
  tsx scripts/import-to-db.ts --library-id <uuid> --type markdown --markdown-path data/tsp.md
  
  # Import notebook
  tsx scripts/import-to-db.ts --library-id <uuid> --type notebook \\
    --notebook-path temp/notebooks/Sudoku.ipynb \\
    --markdown-path markdown/sudoku/sudoku.md

What it does:
  ✓ Imports concepts, prerequisites, chunks, embeddings
  ✓ Sets appropriate source_type (markdown/notebook)
  ✓ Stores original .ipynb for notebooks
  ✓ Uses transactions (all-or-nothing)
  ✓ Verifies data integrity
`);
  process.exit(0);
}

importToDb(args).catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
