#!/usr/bin/env tsx
/**
 * Map markdown chunks to concepts using Gemini
 * 
 * Takes chunks and the concept graph, and determines which concepts
 * are covered/referenced in each chunk.
 * 
 * Usage:
 *   npx tsx scripts/markdown/map-chunks-to-concepts.ts <markdown-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { zodToGeminiSchema } from '../../lib/gemini-utils';

// Schema for chunk-concept mapping (matching YouTube's structure)
const chunkConceptMappingSchema = z.object({
  chunk_id: z.string(),
  concept_id: z.string().describe('Primary concept ID covered in this chunk'),
  confidence: z.number().min(0).max(1).describe('Confidence score for this mapping'),
  secondary_concepts: z.array(z.string()).optional().describe('Additional concepts referenced'),
  reasoning: z.string().optional().describe('Brief explanation of why this concept was selected'),
});

const mappingsOutputSchema = z.object({
  mappings: z.array(chunkConceptMappingSchema),
});

type ChunkConceptMapping = z.infer<typeof chunkConceptMappingSchema>;

// Type for chunks with mappings
interface MappedChunk {
  chunk_id: string;
  title?: string;
  content: string;
  type?: string;
  section?: string;
  start_line?: number;
  end_line?: number;
  concept_mapping: ChunkConceptMapping;
}

function backfillUnmappedChunks(chunks: MappedChunk[]): MappedChunk[] {
  console.log('\n📋 Backfilling unmapped chunks...');
  
  let backfilled = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const mapping = chunk.concept_mapping;
    
    // If unmapped or low confidence
    if (!mapping || mapping.concept_id === 'unmapped' || mapping.confidence < 0.3) {
      const prev = chunks[i-1]?.concept_mapping;
      const next = chunks[i+1]?.concept_mapping;
      
      // If surrounded by same concept, inherit it
      if (prev && next && 
          prev.concept_id === next.concept_id &&
          prev.concept_id !== 'unmapped' &&
          prev.confidence >= 0.5 && next.confidence >= 0.5) {
        
        chunk.concept_mapping = {
          chunk_id: chunk.chunk_id,
          concept_id: prev.concept_id,
          confidence: 0.6,
          reasoning: `Inferred from surrounding context (prev=${prev.concept_id}, next=${next.concept_id})`
        };
        backfilled++;
        console.log(`   ✓ Chunk ${chunk.chunk_id}: inferred as ${prev.concept_id}`);
      }
      // If only one neighbor with high confidence, inherit from it
      else if (prev && prev.concept_id !== 'unmapped' && prev.confidence >= 0.6) {
        chunk.concept_mapping = {
          chunk_id: chunk.chunk_id,
          concept_id: prev.concept_id,
          confidence: 0.5,
          reasoning: `Inferred from previous chunk (${prev.concept_id})`
        };
        backfilled++;
        console.log(`   ✓ Chunk ${chunk.chunk_id}: inferred as ${prev.concept_id} (from prev)`);
      }
      else if (next && next.concept_id !== 'unmapped' && next.confidence >= 0.6) {
        chunk.concept_mapping = {
          chunk_id: chunk.chunk_id,
          concept_id: next.concept_id,
          confidence: 0.5,
          reasoning: `Inferred from next chunk (${next.concept_id})`
        };
        backfilled++;
        console.log(`   ✓ Chunk ${chunk.chunk_id}: inferred as ${next.concept_id} (from next)`);
      }
    }
  }
  
  console.log(`   📊 Backfilled ${backfilled} chunks`);
  return chunks;
}

function printMappingStats(chunks: MappedChunk[], conceptGraph: any) {
  console.log('\n📊 Mapping Statistics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const conceptCounts = new Map<string, number>();
  let unmapped = 0;
  let lowConfidence = 0;
  
  for (const chunk of chunks) {
    const mapping = chunk.concept_mapping;
    if (!mapping || mapping.concept_id === 'unmapped') {
      unmapped++;
    } else {
      conceptCounts.set(
        mapping.concept_id,
        (conceptCounts.get(mapping.concept_id) || 0) + 1
      );
      if (mapping.confidence < 0.5) {
        lowConfidence++;
      }
    }
  }
  
  console.log(`Total chunks: ${chunks.length}`);
  console.log(`Unmapped: ${unmapped}`);
  console.log(`Low confidence (<0.5): ${lowConfidence}`);
  console.log(`\nChunks per concept:`);
  
  const sorted = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1]);
  
  for (const [conceptId, count] of sorted) {
    const concept = conceptGraph.nodes.find((c: any) => c.id === conceptId);
    const name = concept ? concept.name : conceptId;
    console.log(`  ${name}: ${count} chunks`);
  }
}

async function mapChunksToConcepts(markdownPath: string): Promise<void> {
  console.log(`\n🔗 CHUNK-CONCEPT MAPPING`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📄 Markdown file: ${markdownPath}\n`);

  // Setup paths - use the directory where the markdown file actually is
  const workDir = path.dirname(markdownPath);
  const chunksPath = path.join(workDir, 'chunks.json');
  const conceptGraphPath = path.join(workDir, 'concept-graph-enriched.json');
  const outputPath = path.join(workDir, 'chunk-concept-mappings.json');

  // Check inputs exist
  if (!fs.existsSync(chunksPath)) {
    throw new Error(`❌ Chunks not found: ${chunksPath}\nRun chunk-markdown.ts first`);
  }
  if (!fs.existsSync(conceptGraphPath)) {
    throw new Error(`❌ Enriched concepts not found: ${conceptGraphPath}\nRun enrich-concepts.ts first`);
  }

  // Load data
  const chunksData = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
  const conceptGraph = JSON.parse(fs.readFileSync(conceptGraphPath, 'utf-8'));

  const chunks = chunksData.chunks || [];
  const concepts = conceptGraph.nodes || [];

  console.log(`📊 Loaded:`);
  console.log(`   - ${chunks.length} chunks`);
  console.log(`   - ${concepts.length} concepts\n`);

  // Build concept reference for Gemini
  const conceptReference = concepts.map((c: any) => 
    `- ${c.id}: ${c.name} - ${c.description}`
  ).join('\n');

  // Initialize Gemini
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('❌ GOOGLE_API_KEY or GEMINI_API_KEY not set');
  }
  const genAI = new GoogleGenerativeAI(apiKey);

  // Process chunks in batches (matching YouTube's batch size)
  const BATCH_SIZE = 100;
  const mappedChunks: MappedChunk[] = [];

  const batches: any[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }

  console.log(`🔄 Mapping chunks to concepts in batches of ${BATCH_SIZE}...`);
  console.log(`   Total batches: ${batches.length}\n`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = batchIdx * BATCH_SIZE;

    console.log(`📦 Batch ${batchIdx + 1}/${batches.length}: chunks ${batchStart}-${batchStart + batch.length - 1}`);

    const prompt = `You are analyzing markdown chunks and mapping each to its primary concept.

**Available concepts:**
${conceptReference}

**Task:** Map each chunk below to its primary concept.

Guidelines:
- Choose the MOST specific concept for each chunk
- If transitional or too generic, set confidence below 0.3
- Consider the chunk's title and content
- Use exact concept IDs from the list above

**Chunks to map (${batch.length} total):**
${batch.map((chunk: any) => {
  const content = chunk.content || chunk.text || '';
  const preview = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
  return `
Chunk ID: ${chunk.chunk_id}
Title: ${chunk.title || 'Untitled'}
Content: ${preview || '(empty)'}
`.trim();
}).join('\n\n')}

Return a JSON object with a "mappings" array containing mappings for ALL ${batch.length} chunks in order.
Each mapping must include: chunk_id, concept_id, confidence, and optionally secondary_concepts and reasoning.`;

    try {
      const startTime = Date.now();
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: zodToGeminiSchema(mappingsOutputSchema),
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const parsed = JSON.parse(response.text());
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Build mapping lookup
      const mappingsByChunkId = new Map(
        parsed.mappings.map((m: any) => [m.chunk_id, m])
      );

      // Merge mappings with chunks
      for (const chunk of batch) {
        const mapping = mappingsByChunkId.get(chunk.chunk_id) || {
          chunk_id: chunk.chunk_id,
          concept_id: 'unmapped',
          confidence: 0,
          reasoning: 'Failed to map in batch'
        };

        mappedChunks.push({
          chunk_id: chunk.chunk_id,
          title: chunk.title,
          content: chunk.content || chunk.text || '',
          type: chunk.type,
          section: chunk.section,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
          concept_mapping: mapping,
        });
      }

      console.log(`   ✓ Mapped ${parsed.mappings.length}/${batch.length} chunks in ${elapsed}s`);

    } catch (error: any) {
      console.error(`   ❌ Batch ${batchIdx + 1} failed: ${error.message}`);
      throw error;
    }

    // Rate limiting
    if (batchIdx < batches.length - 1) {
      console.log(`   ⏸️  Pausing 1s before next batch...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n   ✓ Mapped all ${mappedChunks.length} chunks\n`);

  // Backfill unmapped chunks using surrounding context
  const backfilled = backfillUnmappedChunks(mappedChunks);

  // Print statistics
  printMappingStats(backfilled, conceptGraph);

  // Save mappings with full chunk data
  const output = {
    source_file: markdownPath,
    total_chunks: backfilled.length,
    mapped_at: new Date().toISOString(),
    chunks: backfilled,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Saved mappings to: ${outputPath}`);
  console.log('\n🎉 Chunk-to-concept mapping complete!\n');
}

// CLI
async function main() {
  const markdownPath = process.argv[2];

  if (!markdownPath) {
    console.error('Usage: npx tsx map-chunks-to-concepts.ts <markdown-file>');
    console.error('Example: npx tsx map-chunks-to-concepts.ts ../../pytudes/ipynb/TSP.md');
    process.exit(1);
  }

  try {
    await mapChunksToConcepts(markdownPath);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
