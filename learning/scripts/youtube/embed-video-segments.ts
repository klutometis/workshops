/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs/promises';
import path from 'path';
import { generateEmbeddings, type TextSegment, type EmbeddingResult as LibEmbeddingResult } from '../../lib/embeddings.js';

// YouTube-specific types
interface VideoSegment {
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
  };
  concept_mapping?: {
    concept_id: string;
    confidence: number;
    reasoning?: string;
  };
}

interface SegmentMappingsData {
  video_id: string;
  video_title?: string;
  total_segments: number;
  mapped_segments: number;
  segments: VideoSegment[];
  metadata?: any;
}

interface EmbeddedVideoSegment extends VideoSegment {
  video_id: string;
  embedding: number[];
  embedding_model: string;
  embedding_text: string; // What was actually embedded (for debugging)
}

interface EmbeddingResult {
  video_id: string;
  video_title?: string;
  segments: EmbeddedVideoSegment[];
  metadata: {
    total_embeddings: number;
    embedded_at: string;
    embedding_model: string;
    embedding_dimensions: number;
    source_file: string;
  };
}

/**
 * Create rich embedding text from all available video segment content
 * 
 * Combines: audio transcript + visual description + code + slides + concepts
 * This domain-specific enrichment happens before calling the shared embedding library
 */
function createEmbeddingText(segment: VideoSegment, conceptName?: string): string {
  const parts: string[] = [];
  
  // Add audio transcript
  if (segment.audio_text && segment.audio_text.trim()) {
    parts.push(`Transcript: ${segment.audio_text}`);
  }
  
  // Add visual description
  if (segment.analysis?.visual_description) {
    parts.push(`Visual: ${segment.analysis.visual_description}`);
  }
  
  // Add code content (high value for technical videos)
  if (segment.analysis?.code_content && segment.analysis.code_content.trim()) {
    parts.push(`Code: ${segment.analysis.code_content}`);
  }
  
  // Add slide content
  if (segment.analysis?.slide_content && segment.analysis.slide_content.trim()) {
    parts.push(`Slides: ${segment.analysis.slide_content}`);
  }
  
  // Add key concepts
  if (segment.analysis?.key_concepts && segment.analysis.key_concepts.length > 0) {
    parts.push(`Key Concepts: ${segment.analysis.key_concepts.join(', ')}`);
  }
  
  // Add mapped concept name (helps with semantic search)
  if (conceptName) {
    parts.push(`Teaching: ${conceptName}`);
  }
  
  return parts.join('\n\n');
}

/**
 * Transform video segments into generic text segments for embedding
 */
function videoSegmentsToTextSegments(
  segments: VideoSegment[],
  conceptNames: Map<string, string>
): TextSegment[] {
  return segments.map(segment => {
    const conceptName = segment.concept_mapping?.concept_id
      ? conceptNames.get(segment.concept_mapping.concept_id)
      : undefined;
    
    const embeddingText = createEmbeddingText(segment, conceptName);
    
    return {
      id: `segment-${segment.segment_index}`,
      text: embeddingText,
      metadata: {
        segment_index: segment.segment_index,
        timestamp: segment.timestamp,
        audio_start: segment.audio_start,
        audio_end: segment.audio_end,
        frame_path: segment.frame_path,
        concept_mapping: segment.concept_mapping,
        analysis: segment.analysis,
      },
    };
  });
}

// Load concept graph to get human-readable concept names
async function loadConceptNames(videoId: string): Promise<Map<string, string>> {
  const conceptGraphPath = path.join(
    process.cwd(),
    `youtube/${videoId}/concept-graph.json`
  );
  
  try {
    const data = JSON.parse(await fs.readFile(conceptGraphPath, 'utf-8'));
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

// Main embedding function
async function embedVideoSegments(videoId: string, outputPath?: string) {
  console.log('🎬 Video Segment Embedding Generator\n');
  
  // Construct input path from video ID
  const inputPath = path.join(process.cwd(), `youtube/${videoId}/segment-concept-mappings.json`);
  
  // Read segment mappings file
  console.log(`📖 Reading ${inputPath}...`);
  
  let segmentData: SegmentMappingsData;
  try {
    const fileContent = await fs.readFile(inputPath, 'utf-8');
    segmentData = JSON.parse(fileContent);
    console.log(`✅ Loaded ${segmentData.segments.length} segments`);
    console.log(`   Video ID: ${segmentData.video_id}`);
    console.log(`   Title: ${segmentData.video_title || 'N/A'}\n`);
  } catch (error) {
    console.error(`❌ Failed to read file: ${error}`);
    process.exit(1);
  }
  
  // Load concept names for richer embeddings
  console.log('📚 Loading concept names...');
  const conceptNames = await loadConceptNames(segmentData.video_id);
  console.log(`   Found ${conceptNames.size} concept names\n`);
  
  const modelName = 'gemini-embedding-001';
  console.log(`🔢 Using model: ${modelName}`);
  console.log(`📊 Processing ${segmentData.segments.length} segments...\n`);
  
  // Transform video segments into generic text segments
  const textSegments = videoSegmentsToTextSegments(segmentData.segments, conceptNames);
  
  // Generate embeddings using shared library
  console.log(`🔮 Generating embeddings using shared library...\n`);
  const result = await generateEmbeddings({
    segments: textSegments,
    model: modelName,
    batchSize: 10, // Video segments can be rich, so use smaller batches
  });
  
  console.log(`\n✅ Successfully embedded ${result.segments.length}/${segmentData.segments.length} segments\n`);
  
  // Transform results back to YouTube format (preserve all video metadata)
  const embeddedSegments: EmbeddedVideoSegment[] = result.segments.map(embeddedSeg => {
    const originalSegment = segmentData.segments[embeddedSeg.metadata.segment_index];
    
    return {
      ...originalSegment,
      video_id: segmentData.video_id,
      embedding: embeddedSeg.embedding,
      embedding_model: result.metadata.embedding_model,
      embedding_text: embeddedSeg.text, // What was actually embedded
    };
  });
  
  const embeddingDimensions = result.metadata.embedding_dimensions;
  console.log(`🔍 Embedding dimensions: ${embeddingDimensions}`);
  
  // Create output
  const output: EmbeddingResult = {
    video_id: segmentData.video_id,
    video_title: segmentData.video_title,
    segments: embeddedSegments,
    metadata: {
      total_embeddings: embeddedSegments.length,
      embedded_at: new Date().toISOString(),
      embedding_model: modelName,
      embedding_dimensions: embeddingDimensions,
      source_file: inputPath,
    },
  };
  
  // Save to file
  const finalOutputPath = outputPath || path.join(process.cwd(), `youtube/${videoId}/segment-embeddings.json`);
  await fs.writeFile(finalOutputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved embeddings to ${finalOutputPath}`);
  
  // Display sample
  console.log('\n📊 Summary:');
  console.log(`   Video ID: ${segmentData.video_id}`);
  console.log(`   Total embeddings: ${embeddedSegments.length}`);
  console.log(`   Embedding model: ${modelName}`);
  console.log(`   Dimensions: ${embeddingDimensions}`);
  console.log(`   File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
  
  // Show a sample embedding with YouTube link
  const sample = embeddedSegments[Math.floor(embeddedSegments.length / 2)];
  console.log(`\n📝 Sample Embedding:`);
  console.log(`   Segment: ${sample.segment_index}`);
  console.log(`   Video ID: ${sample.video_id}`);
  console.log(`   Timestamp: ${sample.timestamp.toFixed(2)}s`);
  console.log(`   Concept: ${sample.concept_mapping?.concept_id || 'N/A'}`);
  console.log(`   Audio: "${sample.audio_text.substring(0, 60)}..."`);
  console.log(`   Vector: [${sample.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...] (${sample.embedding.length}D)`);
  
  // Stats by concept
  const conceptCounts = new Map<string, number>();
  for (const seg of embeddedSegments) {
    if (seg.concept_mapping?.concept_id) {
      const count = conceptCounts.get(seg.concept_mapping.concept_id) || 0;
      conceptCounts.set(seg.concept_mapping.concept_id, count + 1);
    }
  }
  
  console.log(`\n📈 Embeddings by Concept (Top 10):`);
  const sortedConcepts = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [conceptId, count] of sortedConcepts) {
    const name = conceptNames.get(conceptId) || conceptId;
    console.log(`   ${name}: ${count} segments`);
  }
  
  console.log('\n✨ Done! Video segments are now embedded with full YouTube provenance.\n');
  console.log('💡 Use video_id + timestamp to render embedded players or deep links in your UI.\n');
}

// Parse command line arguments
function parseArgs(): { videoId: string; outputPath?: string } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx scripts/youtube/embed-video-segments.ts <video-id> [output.json]

Arguments:
  video-id                 YouTube video ID (e.g., kCc8FmEb1nY)
  output.json              (optional) Path for output embeddings file
                           Default: youtube/<video-id>/segment-embeddings.json

Examples:
  npx tsx scripts/youtube/embed-video-segments.ts kCc8FmEb1nY
  npx tsx scripts/youtube/embed-video-segments.ts kCc8FmEb1nY custom-output.json

Features:
  ✓ Preserves full YouTube video provenance (video_id, timestamp, frame_path)
  ✓ Stores primitives (video_id, timestamp) for flexible UI rendering
  ✓ Creates rich embeddings from audio + visuals + code + slides + concepts
  ✓ Enables semantic search with results that can jump to video moments
`);
    process.exit(0);
  }
  
  return {
    videoId: args[0],
    outputPath: args[1],
  };
}

// Run it
const { videoId, outputPath } = parseArgs();
embedVideoSegments(videoId, outputPath).catch(console.error);
