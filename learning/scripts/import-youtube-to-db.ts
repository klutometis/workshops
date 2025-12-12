/**
 * Import existing YouTube pipeline JSON files into PostgreSQL database
 * 
 * Setup: npm install pg @types/pg
 * Usage: tsx scripts/import-youtube-to-db.ts <video-id>
 * Example: tsx scripts/import-youtube-to-db.ts kCc8FmEb1nY
 * 
 * Reads from youtube/<video-id>/ directory:
 * - concept-graph.json
 * - segment-concept-mappings.json
 * - segment-embeddings.json
 * 
 * And imports into database tables:
 * - libraries
 * - concepts
 * - prerequisites
 * - segments
 * - embeddings
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types (matching our JSON file structures)
// ============================================================================

interface ConceptGraph {
  metadata: {
    title: string;
    author: string;
    source: string;
    video_id: string;
    total_duration: number;
    total_concepts: number;
    extracted_at: string;
    enriched_at?: string;
  };
  nodes: Array<{
    id: string;
    name: string;
    description: string;
    prerequisites: string[];
    difficulty: 'basic' | 'intermediate' | 'advanced';
    time_ranges?: Array<{ start: number; end: number }>;
    learning_objectives?: string[];
    common_misconceptions?: string[];
  }>;
}

interface SegmentMappings {
  video_id: string;
  video_title?: string;
  total_segments: number;
  segments: Array<{
    segment_index: number;
    timestamp: number;
    audio_text: string;
    audio_start: number;
    audio_end: number;
    frame_path: string;
    analysis?: {
      visual_description?: string;
      code_content?: string;
      slide_content?: string;
      visual_audio_alignment?: string;
      key_concepts?: string[];
      is_code_readable?: boolean;
    };
    concept_mapping?: {
      concept_id: string;
      confidence: number;
      secondary_concepts?: string[];
      reasoning?: string;
    };
  }>;
}

interface SegmentEmbeddings {
  video_id: string;
  segments: Array<{
    segment_index: number;
    embedding: number[];
    embedding_model: string;
    embedding_text: string;
  }>;
  metadata: {
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
// File Loading
// ============================================================================

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function loadYoutubeData(videoId: string) {
  const baseDir = path.join(process.cwd(), 'youtube', videoId);
  
  console.log(`📂 Loading JSON files from: ${baseDir}\n`);
  
  const conceptGraphPath = path.join(baseDir, 'concept-graph-enriched.json');
  const segmentMappingsPath = path.join(baseDir, 'segment-concept-mappings.json');
  const embeddingsPath = path.join(baseDir, 'segment-embeddings.json');
  
  // Check files exist
  const files = [
    { path: conceptGraphPath, name: 'concept-graph.json' },
    { path: segmentMappingsPath, name: 'segment-concept-mappings.json' },
    { path: embeddingsPath, name: 'segment-embeddings.json' },
  ];
  
  for (const file of files) {
    try {
      await fs.access(file.path);
      console.log(`   ✓ Found ${file.name}`);
    } catch {
      throw new Error(`❌ Missing file: ${file.path}`);
    }
  }
  console.log();
  
  const [conceptGraph, segmentMappings, embeddings] = await Promise.all([
    loadJsonFile<ConceptGraph>(conceptGraphPath),
    loadJsonFile<SegmentMappings>(segmentMappingsPath),
    loadJsonFile<SegmentEmbeddings>(embeddingsPath),
  ]);
  
  return { conceptGraph, segmentMappings, embeddings };
}

// ============================================================================
// Database Import Functions
// ============================================================================

async function importLibrary(pool: Pool, conceptGraph: ConceptGraph): Promise<string> {
  console.log(`📚 Importing library...`);
  
  const slug = generateSlug(conceptGraph.metadata.title);
  console.log(`   Generated slug: ${slug}`);
  
  const result = await pool.query(
    `INSERT INTO libraries (
      title, author, type, slug, source_url, video_id, 
      total_duration, total_concepts, status, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (video_id) 
    DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      slug = EXCLUDED.slug,
      total_duration = EXCLUDED.total_duration,
      total_concepts = EXCLUDED.total_concepts,
      status = EXCLUDED.status,
      processed_at = EXCLUDED.processed_at
    RETURNING id`,
    [
      conceptGraph.metadata.title,
      conceptGraph.metadata.author,
      'youtube',
      slug,
      conceptGraph.metadata.source,
      conceptGraph.metadata.video_id,
      conceptGraph.metadata.total_duration,
      conceptGraph.metadata.total_concepts,
      'ready',
      conceptGraph.metadata.enriched_at || conceptGraph.metadata.extracted_at,
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
  console.log(`🎓 Importing ${conceptGraph.nodes.length} concepts...`);
  
  // Delete existing concepts for this library (cascade will handle prerequisites)
  await pool.query('DELETE FROM concepts WHERE library_id = $1', [libraryId]);
  
  // Insert concepts
  for (const node of conceptGraph.nodes) {
    await pool.query(
      `INSERT INTO concepts (
        library_id, concept_id, name, description, difficulty,
        learning_objectives, common_misconceptions, mastery_indicators, time_ranges
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        libraryId,
        node.id,
        node.name,
        node.description,
        node.difficulty,
        JSON.stringify(node.learning_objectives || []),
        JSON.stringify(node.common_misconceptions || []),
        JSON.stringify(node.mastery_indicators || []),
        JSON.stringify(node.time_ranges || []),
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
  
  let totalPrereqs = 0;
  
  // Create prerequisite edges
  for (const node of conceptGraph.nodes) {
    for (const prereqId of node.prerequisites) {
      await pool.query(
        `INSERT INTO prerequisites (library_id, from_concept_id, to_concept_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (library_id, from_concept_id, to_concept_id) DO NOTHING`,
        [libraryId, prereqId, node.id]
      );
      totalPrereqs++;
    }
  }
  
  console.log(`   ✓ ${totalPrereqs} prerequisite edges imported\n`);
}

async function importSegments(
  pool: Pool,
  libraryId: string,
  segmentMappings: SegmentMappings
): Promise<Map<number, string>> {
  console.log(`📹 Importing ${segmentMappings.segments.length} segments...`);
  
  // Delete existing segments (cascade will handle embeddings)
  await pool.query('DELETE FROM segments WHERE library_id = $1', [libraryId]);
  
  const segmentIndexToId = new Map<number, string>();
  
  for (const segment of segmentMappings.segments) {
    const result = await pool.query(
      `INSERT INTO segments (
        library_id, segment_index, segment_timestamp, audio_start, audio_end,
        audio_text, frame_path, visual_description, code_content, slide_content,
        visual_audio_alignment, key_concepts, is_code_readable,
        mapped_concept_id, mapping_confidence, secondary_concepts, mapping_reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        libraryId,
        segment.segment_index,
        segment.timestamp,
        segment.audio_start,
        segment.audio_end,
        segment.audio_text,
        segment.frame_path,
        segment.analysis?.visual_description || null,
        segment.analysis?.code_content || null,
        segment.analysis?.slide_content || null,
        segment.analysis?.visual_audio_alignment || null,
        JSON.stringify(segment.analysis?.key_concepts || []),
        segment.analysis?.is_code_readable ?? null,
        segment.concept_mapping?.concept_id || null,
        segment.concept_mapping?.confidence ?? null,
        JSON.stringify(segment.concept_mapping?.secondary_concepts || []),
        segment.concept_mapping?.reasoning || null,
      ]
    );
    
    segmentIndexToId.set(segment.segment_index, result.rows[0].id);
  }
  
  console.log(`   ✓ Segments imported\n`);
  
  return segmentIndexToId;
}

async function importEmbeddings(
  pool: Pool,
  libraryId: string,
  embeddings: SegmentEmbeddings,
  segmentIndexToId: Map<number, string>
): Promise<void> {
  console.log(`🔢 Importing ${embeddings.segments.length} embeddings...`);
  
  // Delete existing embeddings
  await pool.query('DELETE FROM embeddings WHERE library_id = $1', [libraryId]);
  
  let imported = 0;
  let skipped = 0;
  
  for (const embSeg of embeddings.segments) {
    const segmentId = segmentIndexToId.get(embSeg.segment_index);
    
    if (!segmentId) {
      console.log(`   ⚠️  Skipping embedding for segment ${embSeg.segment_index} (segment not found)`);
      skipped++;
      continue;
    }
    
    // Convert embedding array to pgvector format: '[0.1, 0.2, ...]'
    const vectorString = `[${embSeg.embedding.join(',')}]`;
    
    await pool.query(
      `INSERT INTO embeddings (
        library_id, segment_id, embedding, embedding_model, embedding_text, content_type
      ) VALUES ($1, $2, $3::vector, $4, $5, $6)`,
      [
        libraryId,
        segmentId,
        vectorString,
        embSeg.embedding_model,
        embSeg.embedding_text,
        'video_segment',
      ]
    );
    
    imported++;
  }
  
  console.log(`   ✓ ${imported} embeddings imported${skipped > 0 ? ` (${skipped} skipped)` : ''}\n`);
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function importYoutubeVideo(videoId: string): Promise<void> {
  console.log(`\n🎬 YouTube Video Import to Database`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📹 Video ID: ${videoId}\n`);
  
  // Load data
  const { conceptGraph, segmentMappings, embeddings } = await loadYoutubeData(videoId);
  
  console.log(`📊 Data Summary:`);
  console.log(`   Title: ${conceptGraph.metadata.title}`);
  console.log(`   Author: ${conceptGraph.metadata.author}`);
  console.log(`   Duration: ${Math.floor(conceptGraph.metadata.total_duration / 60)} minutes`);
  console.log(`   Concepts: ${conceptGraph.nodes.length}`);
  console.log(`   Segments: ${segmentMappings.segments.length}`);
  console.log(`   Embeddings: ${embeddings.segments.length}`);
  console.log(`   Embedding dimensions: ${embeddings.metadata.embedding_dimensions}\n`);
  
  // Create database connection
  const pool = createPool();
  
  try {
    // Begin transaction
    console.log(`🔄 Starting database transaction...\n`);
    await pool.query('BEGIN');
    
    // Import in correct order (respecting foreign keys)
    const libraryId = await importLibrary(pool, conceptGraph);
    await importConcepts(pool, libraryId, conceptGraph);
    await importPrerequisites(pool, libraryId, conceptGraph);
    const segmentIndexToId = await importSegments(pool, libraryId, segmentMappings);
    await importEmbeddings(pool, libraryId, embeddings, segmentIndexToId);
    
    // Commit transaction
    await pool.query('COMMIT');
    console.log(`✅ Transaction committed successfully!\n`);
    
    // Verification queries
    console.log(`🔍 Verification:`);
    
    const counts = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM concepts WHERE library_id = $1) as concepts,
        (SELECT COUNT(*) FROM prerequisites WHERE library_id = $1) as prerequisites,
        (SELECT COUNT(*) FROM segments WHERE library_id = $1) as segments,
        (SELECT COUNT(*) FROM embeddings WHERE library_id = $1) as embeddings`,
      [libraryId]
    );
    
    console.log(`   Concepts: ${counts.rows[0].concepts}`);
    console.log(`   Prerequisites: ${counts.rows[0].prerequisites}`);
    console.log(`   Segments: ${counts.rows[0].segments}`);
    console.log(`   Embeddings: ${counts.rows[0].embeddings}\n`);
    
    // Test vector search
    console.log(`🔍 Testing vector search...`);
    const searchTest = await pool.query(
      `SELECT 
        s.segment_index,
        s.segment_timestamp,
        s.audio_text,
        s.mapped_concept_id,
        1 - (e.embedding <=> (SELECT embedding FROM embeddings LIMIT 1)) as similarity
      FROM embeddings e
      JOIN segments s ON e.segment_id = s.id
      WHERE e.library_id = $1
      ORDER BY e.embedding <=> (SELECT embedding FROM embeddings LIMIT 1)
      LIMIT 5`,
      [libraryId]
    );
    
    console.log(`   ✓ Vector search working! Sample results:`);
    for (const row of searchTest.rows) {
      console.log(`      [${row.segment_index}] @${row.segment_timestamp.toFixed(1)}s - ${row.audio_text.substring(0, 50)}...`);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ Import Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`🎉 Video "${conceptGraph.metadata.title}" successfully imported!`);
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

const videoId = process.argv[2];

if (!videoId || videoId === '--help' || videoId === '-h') {
  console.log(`
Usage: tsx scripts/import-youtube-to-db.ts <video-id>

Import existing YouTube pipeline JSON files into PostgreSQL database.

Arguments:
  video-id    YouTube video ID (e.g., kCc8FmEb1nY)

Environment Variables:
  DATABASE_URL or LEARNING_DATABASE_URL_PROXY
    PostgreSQL connection string
    Example: postgresql://postgres:password@localhost:5432/learning

Examples:
  # Import Karpathy GPT video
  tsx scripts/import-youtube-to-db.ts kCc8FmEb1nY
  
  # With explicit connection string
  DATABASE_URL="postgresql://postgres:pass@localhost:5432/learning" \\
    tsx scripts/import-youtube-to-db.ts kCc8FmEb1nY

What it does:
  ✓ Reads concept-graph.json, segment-concept-mappings.json, segment-embeddings.json
  ✓ Imports into PostgreSQL: libraries → concepts → prerequisites → segments → embeddings
  ✓ Uses transaction (all-or-nothing import)
  ✓ Verifies data integrity and tests vector search
  ✓ Handles conflicts (re-importing will update existing data)
`);
  process.exit(0);
}

importYoutubeVideo(videoId).catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
