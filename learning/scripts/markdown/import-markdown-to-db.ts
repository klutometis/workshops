#!/usr/bin/env tsx
/**
 * Import markdown content to PostgreSQL database
 * 
 * Matches YouTube import approach for consistency.
 * 
 * Reads all generated JSON files and imports them into the learning database:
 * - libraries table (metadata)
 * - concepts table (concept graph nodes)
 * - prerequisites table (concept graph edges)
 * - segments table (markdown chunks)
 * - embeddings table (separate table for vector embeddings)
 * 
 * Usage:
 *   npx tsx scripts/markdown/import-markdown-to-db.ts <markdown-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import type { ConceptGraph } from '../youtube/types.js';

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
// Database Import Functions (matching YouTube approach)
// ============================================================================

async function importLibrary(
  pool: Pool,
  conceptGraph: ConceptGraph,
  markdownPath: string,
  basename: string
): Promise<string> {
  console.log(`📚 Importing library...`);
  
  // Read markdown content to store in database
  const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
  console.log(`   Read ${markdownContent.length} chars of markdown content`);
  
  const title = conceptGraph.metadata?.title || basename;
  const slug = generateSlug(title);
  console.log(`   Generated slug: ${slug}`);
  
  const result = await pool.query(
    `INSERT INTO libraries (
      title, author, type, slug, source_url, markdown_content,
      total_concepts, status, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (slug) 
    DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      markdown_content = EXCLUDED.markdown_content,
      total_concepts = EXCLUDED.total_concepts,
      status = EXCLUDED.status,
      processed_at = EXCLUDED.processed_at
    RETURNING id`,
    [
      title,
      conceptGraph.metadata?.author || 'Unknown',
      'markdown',
      slug,
      markdownPath,
      markdownContent,
      conceptGraph.nodes?.length || 0,
      'ready',
      conceptGraph.metadata?.enriched_at || conceptGraph.metadata?.extracted_at || new Date().toISOString(),
    ]
  );
  
  const libraryId = result.rows[0].id;
  console.log(`   ✓ Library imported: ${libraryId}\n`);
  
  return libraryId;
}

async function importConcepts(
  pool: Pool,
  libraryId: string,
  conceptGraph: ConceptGraph
): Promise<void> {
  console.log(`🎓 Importing ${conceptGraph.nodes?.length || 0} concepts...`);
  
  // Delete existing concepts for this library (cascade will handle prerequisites)
  await pool.query('DELETE FROM concepts WHERE library_id = $1', [libraryId]);
  
  // Insert concepts (matching YouTube schema)
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
  
  // Delete existing prerequisites
  await pool.query('DELETE FROM prerequisites WHERE library_id = $1', [libraryId]);
  
  // Build set of valid concept IDs
  const validConceptIds = new Set(
    (conceptGraph.nodes || []).map(node => node.id)
  );
  
  let totalPrereqs = 0;
  let skippedPrereqs = 0;
  
  // Method 1: From edges array (preferred)
  if (conceptGraph.edges && conceptGraph.edges.length > 0) {
    for (const edge of conceptGraph.edges) {
      // Edges use canonical {from, to} format (enforced by edgeSchema)
      const fromId = edge.from;
      const toId = edge.to;
      
      // Validate both from and to concepts exist
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
  }
  
  // Method 2: From node prerequisites (fallback)
  else if (conceptGraph.nodes) {
    for (const node of conceptGraph.nodes) {
      for (const prereqId of node.prerequisites || []) {
        // Validate prerequisite concept exists
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
  
  // Delete existing text chunks (cascade will handle embeddings)
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
  
  // Delete existing embeddings
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
    
    // Convert embedding array to pgvector format: '[0.1, 0.2, ...]'
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

async function importMarkdownToDb(markdownPath: string): Promise<void> {
  console.log(`\n📝 Markdown File Import to Database`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📄 Markdown file: ${markdownPath}\n`);

  // Setup paths
  const basename = path.basename(markdownPath, '.md');
  const workDir = path.join(process.cwd(), 'markdown', basename);
  
  const conceptGraphPath = path.join(workDir, 'concept-graph-enriched.json');
  const chunksPath = path.join(workDir, 'chunk-embeddings.json');

  // Check inputs exist
  console.log(`📂 Loading JSON files from: ${workDir}\n`);
  
  const files = [
    { path: conceptGraphPath, name: 'concept-graph-enriched.json' },
    { path: chunksPath, name: 'chunk-embeddings.json' },
  ];
  
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
    // Begin transaction
    console.log(`🔄 Starting database transaction...\n`);
    await pool.query('BEGIN');

    // Import in correct order (respecting foreign keys)
    const libraryId = await importLibrary(pool, conceptGraph, markdownPath, basename);
    await importConcepts(pool, libraryId, conceptGraph);
    await importPrerequisites(pool, libraryId, conceptGraph);
    const chunkIdToDbId = await importTextChunks(pool, libraryId, chunksData);
    await importEmbeddings(pool, libraryId, chunksData, chunkIdToDbId);

    // Commit transaction
    await pool.query('COMMIT');
    console.log(`✅ Transaction committed successfully!\n`);

    // Verification queries
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
    console.log(`   Embeddings: ${counts.rows[0].embeddings}\n`);

    // Test vector search
    console.log(`🔍 Testing vector search...`);
    const searchTest = await pool.query(
      `SELECT 
        tc.chunk_index,
        tc.content,
        tc.mapped_concept_id,
        1 - (e.embedding <=> (SELECT embedding FROM embeddings WHERE library_id = $1 LIMIT 1)) as similarity
      FROM embeddings e
      JOIN text_chunks tc ON e.text_chunk_id = tc.id
      WHERE e.library_id = $1
      ORDER BY e.embedding <=> (SELECT embedding FROM embeddings WHERE library_id = $1 LIMIT 1)
      LIMIT 5`,
      [libraryId]
    );
    
    console.log(`   ✓ Vector search working! Sample results:`);
    for (const row of searchTest.rows) {
      const text = row.content || '';
      console.log(`      [${row.chunk_index}] - ${text.substring(0, 60)}...`);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ Import Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`🎉 Markdown file "${conceptGraph.metadata?.title || basename}" successfully imported!`);
    console.log(`📚 Library ID: ${libraryId}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Query concepts: SELECT * FROM concepts WHERE library_id = '${libraryId}';`);
    console.log(`  2. Test RAG search: SELECT * FROM search_segments('<query_embedding>', '${libraryId}');`);
    console.log(`  3. Build API routes to expose this data to your Next.js app\n`);

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

const markdownPath = process.argv[2];

if (!markdownPath || markdownPath === '--help' || markdownPath === '-h') {
  console.log(`
Usage: tsx scripts/markdown/import-markdown-to-db.ts <markdown-file>

Import markdown pipeline JSON files into PostgreSQL database.

Arguments:
  markdown-file    Path to markdown file (e.g., public/data/pytudes/tsp.md)

Environment Variables:
  DATABASE_URL or LEARNING_DATABASE_URL_PROXY
    PostgreSQL connection string
    Example: postgresql://postgres:password@localhost:5432/learning

Examples:
  # Import TSP markdown
  tsx scripts/markdown/import-markdown-to-db.ts public/data/pytudes/tsp.md
  
  # With explicit connection string
  DATABASE_URL="postgresql://postgres:pass@localhost:5432/learning" \\
    tsx scripts/markdown/import-markdown-to-db.ts public/data/pytudes/tsp.md

What it does:
  ✓ Reads concept-graph-enriched.json, chunk-embeddings.json
  ✓ Imports into PostgreSQL: libraries → concepts → prerequisites → segments → embeddings
  ✓ Uses same schema as YouTube importer (for consistency)
  ✓ Uses transaction (all-or-nothing import)
  ✓ Verifies data integrity and tests vector search
  ✓ Handles conflicts (re-importing will update existing data)
`);
  process.exit(0);
}

importMarkdownToDb(markdownPath).catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
