#!/usr/bin/env tsx
/**
 * Generate embeddings for markdown chunks
 * 
 * Takes chunks with concept mappings and generates embeddings for semantic search.
 * Matches YouTube's embed-video-segments.ts approach.
 * 
 * Usage:
 *   npx tsx scripts/markdown/embed-chunks.ts <markdown-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateEmbeddings, type TextSegment } from '../../lib/embeddings';

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

interface ChunkMappingsData {
  source_file: string;
  total_chunks: number;
  mapped_at: string;
  chunks: MappedChunk[];
}

interface EmbeddedChunk extends MappedChunk {
  embedding: number[];
  embedding_model: string;
  embedding_text: string; // What was actually embedded (for debugging)
}

interface EmbeddingResult {
  source_file: string;
  chunks: EmbeddedChunk[];
  metadata: {
    total_embeddings: number;
    embedded_at: string;
    embedding_model: string;
    embedding_dimensions: number;
  };
}

/**
 * Create rich embedding text from chunk content and metadata
 * 
 * Combines: content + title + section + concept info
 * This domain-specific enrichment happens before calling the shared embedding library
 */
function createEmbeddingText(chunk: MappedChunk, conceptName?: string): string {
  const parts: string[] = [];
  
  // Add title/section context
  if (chunk.title && chunk.title.trim()) {
    parts.push(`Section: ${chunk.title}`);
  } else if (chunk.section && chunk.section.trim()) {
    parts.push(`Section: ${chunk.section}`);
  }
  
  // Add main content
  const content = chunk.content || '';
  if (content.trim()) {
    parts.push(`Content: ${content}`);
  }
  
  // Add concept context (helps with semantic search)
  if (conceptName) {
    parts.push(`Teaching: ${conceptName}`);
  }
  
  // Add secondary concepts if available
  if (chunk.concept_mapping?.secondary_concepts && chunk.concept_mapping.secondary_concepts.length > 0) {
    parts.push(`Related Concepts: ${chunk.concept_mapping.secondary_concepts.join(', ')}`);
  }
  
  return parts.join('\n\n');
}

/**
 * Transform markdown chunks into generic text segments for embedding
 */
function chunksToTextSegments(
  chunks: MappedChunk[],
  conceptNames: Map<string, string>
): TextSegment[] {
  return chunks.map(chunk => {
    const conceptName = chunk.concept_mapping?.concept_id
      ? conceptNames.get(chunk.concept_mapping.concept_id)
      : undefined;
    
    const embeddingText = createEmbeddingText(chunk, conceptName);
    
    return {
      id: chunk.chunk_id,
      text: embeddingText,
      metadata: {
        title: chunk.title,
        type: chunk.type,
        section: chunk.section,
        start_line: chunk.start_line,
        end_line: chunk.end_line,
        concept_mapping: chunk.concept_mapping,
      },
    };
  });
}

/**
 * Load concept graph to get human-readable concept names
 */
async function loadConceptNames(workDir: string): Promise<Map<string, string>> {
  const conceptGraphPath = path.join(workDir, 'concept-graph-enriched.json');
  
  try {
    const data = JSON.parse(fs.readFileSync(conceptGraphPath, 'utf-8'));
    const conceptMap = new Map<string, string>();
    
    for (const concept of data.nodes || []) {
      conceptMap.set(concept.id, concept.name);
    }
    
    return conceptMap;
  } catch (error) {
    console.log(`⚠️  Could not load concept names: ${error}`);
    return new Map();
  }
}

async function embedChunks(markdownPath: string): Promise<void> {
  console.log(`\n🧠 GENERATING EMBEDDINGS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📄 Markdown file: ${markdownPath}\n`);

  // Setup paths
  const basename = path.basename(markdownPath, '.md');
  const workDir = path.join(process.cwd(), 'markdown', basename);
  const mappingsPath = path.join(workDir, 'chunk-concept-mappings.json');
  const outputPath = path.join(workDir, 'chunk-embeddings.json');

  // Check inputs exist
  if (!fs.existsSync(mappingsPath)) {
    throw new Error(`❌ Mappings not found: ${mappingsPath}\nRun map-chunks-to-concepts.ts first`);
  }

  // Load data (now from single file with full chunk data + mappings)
  console.log(`📖 Reading ${mappingsPath}...`);
  const mappingsData: ChunkMappingsData = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
  const chunks = mappingsData.chunks || [];

  console.log(`✅ Loaded ${chunks.length} chunks with mappings`);
  console.log(`   Source: ${mappingsData.source_file || 'N/A'}\n`);

  // Load concept names for richer embeddings
  console.log('📚 Loading concept names...');
  const conceptNames = await loadConceptNames(workDir);
  console.log(`   Found ${conceptNames.size} concept names\n`);

  const modelName = 'gemini-embedding-001';
  console.log(`🔢 Using model: ${modelName}`);
  console.log(`📊 Processing ${chunks.length} chunks...\n`);

  // Transform chunks into generic text segments
  const textSegments = chunksToTextSegments(chunks, conceptNames);

  // Generate embeddings using shared library
  console.log(`🔮 Generating embeddings using shared library...\n`);
  const result = await generateEmbeddings({
    segments: textSegments,
    model: modelName,
    batchSize: 100,
  });

  console.log(`\n✅ Successfully embedded ${result.segments.length}/${chunks.length} chunks\n`);

  // Transform results back to markdown format (preserve all chunk metadata)
  const embeddedChunks: EmbeddedChunk[] = result.segments.map((embeddedSeg, idx) => {
    const originalChunk = chunks[idx];
    
    return {
      ...originalChunk,
      embedding: embeddedSeg.embedding,
      embedding_model: result.metadata.embedding_model,
      embedding_text: embeddedSeg.text, // What was actually embedded
    };
  });

  const embeddingDimensions = result.metadata.embedding_dimensions;
  console.log(`🔍 Embedding dimensions: ${embeddingDimensions}`);

  // Create output
  const output: EmbeddingResult = {
    source_file: markdownPath,
    chunks: embeddedChunks,
    metadata: {
      total_embeddings: embeddedChunks.length,
      embedded_at: new Date().toISOString(),
      embedding_model: modelName,
      embedding_dimensions: embeddingDimensions,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n💾 Saved embeddings to ${outputPath}`);
  
  // Display summary
  console.log('\n📊 Summary:');
  console.log(`   Source: ${path.basename(markdownPath)}`);
  console.log(`   Total embeddings: ${embeddedChunks.length}`);
  console.log(`   Embedding model: ${modelName}`);
  console.log(`   Dimensions: ${embeddingDimensions}`);
  console.log(`   File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
  
  // Show a sample embedding
  const sample = embeddedChunks[Math.floor(embeddedChunks.length / 2)];
  console.log(`\n📝 Sample Embedding:`);
  console.log(`   Chunk: ${sample.chunk_id}`);
  console.log(`   Title: ${sample.title || 'N/A'}`);
  console.log(`   Concept: ${sample.concept_mapping?.concept_id || 'N/A'}`);
  console.log(`   Content: "${sample.content.substring(0, 60)}..."`);
  console.log(`   Vector: [${sample.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...] (${sample.embedding.length}D)`);
  
  // Stats by concept
  const conceptCounts = new Map<string, number>();
  for (const chunk of embeddedChunks) {
    if (chunk.concept_mapping?.concept_id) {
      const count = conceptCounts.get(chunk.concept_mapping.concept_id) || 0;
      conceptCounts.set(chunk.concept_mapping.concept_id, count + 1);
    }
  }
  
  console.log(`\n📈 Embeddings by Concept (Top 10):`);
  const sortedConcepts = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [conceptId, count] of sortedConcepts) {
    const name = conceptNames.get(conceptId) || conceptId;
    console.log(`   ${name}: ${count} chunks`);
  }
  
  console.log('\n✨ Done! Markdown chunks are now embedded.\n');
}

// CLI
async function main() {
  const markdownPath = process.argv[2];

  if (!markdownPath) {
    console.error('Usage: npx tsx embed-chunks.ts <markdown-file>');
    console.error('Example: npx tsx embed-chunks.ts ../../pytudes/ipynb/TSP.md');
    process.exit(1);
  }

  try {
    await embedChunks(markdownPath);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
