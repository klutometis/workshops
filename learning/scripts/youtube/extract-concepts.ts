import * as fs from "fs";
import * as path from "path";
import { extractConcepts } from "../../lib/concept-extractor.js";
import {
  audioTranscriptSchema,
  type AudioTranscript,
  type ConceptGraph,
} from "./types.js";

interface VideoInfo {
  video_id: string;
  title: string;
  author: string;
  channel: string;
  duration: number;
  upload_date: string;
  description: string;
  view_count: number;
  fetched_at: string;
}

// ============================================================================
// Main Extraction Logic
// ============================================================================

async function extractConceptsFromVideo(videoId: string): Promise<void> {
  console.log(`\n🎓 CONCEPT EXTRACTION`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📹 Video ID: ${videoId}\n`);

  // Paths
  const videoDir = path.join(process.cwd(), "youtube", videoId);
  const transcriptPath = path.join(videoDir, "audio-transcript.json");
  const videoInfoPath = path.join(videoDir, "video-info.json");
  const outputPath = path.join(videoDir, "concept-graph.json");

  // Check if transcript exists
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`❌ Transcript not found: ${transcriptPath}`);
  }

  // Check if video info exists
  if (!fs.existsSync(videoInfoPath)) {
    throw new Error(`❌ Video info not found: ${videoInfoPath}\nRun fetch-video-info.ts first!`);
  }

  // Read video info for real title/author
  console.log(`📖 Reading video info...`);
  const videoInfo: VideoInfo = JSON.parse(fs.readFileSync(videoInfoPath, "utf-8"));
  console.log(`   Title: ${videoInfo.title}`);
  console.log(`   Author: ${videoInfo.author}\n`);

  console.log(`📖 Reading transcript...`);
  const raw = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  const transcriptData = audioTranscriptSchema.parse(raw);

  console.log(`   Duration: ${Math.floor(transcriptData.total_duration / 60)} minutes`);
  console.log(`   Segments: ${transcriptData.segments.length}`);
  console.log(`   Transcript length: ${transcriptData.full_transcript.length} characters\n`);

  // Extract concepts using shared library
  console.log(`🔮 Extracting concepts using shared library...`);
  console.log(`   (This may take 30-60 seconds for a long transcript)\n`);

  const startTime = Date.now();

  const conceptGraph = await extractConcepts({
    text: transcriptData.full_transcript,
    title: videoInfo.title,
    author: videoInfo.author,
    sourceType: 'youtube',
    metadata: {
      video_id: videoId,
      source: `https://www.youtube.com/watch?v=${videoId}`,
      total_duration: transcriptData.total_duration,
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Concepts extracted in ${elapsed}s\n`);

  // Save
  console.log(`💾 Saving concept graph...`);
  fs.writeFileSync(outputPath, JSON.stringify(conceptGraph, null, 2));

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ EXTRACTION COMPLETE`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📊 Extracted ${conceptGraph.nodes.length} concepts`);
  console.log(`📁 Saved to: ${outputPath}\n`);

  // Print sample concepts
  console.log(`🎯 Sample concepts:\n`);
  conceptGraph.nodes.slice(0, 5).forEach((node, i) => {
    console.log(`   ${i + 1}. ${node.name} (${node.difficulty})`);
    console.log(`      ${node.description.slice(0, 80)}...`);
    console.log(`      Prerequisites: ${node.prerequisites.length > 0 ? node.prerequisites.join(", ") : "none"}\n`);
  });
}

// ============================================================================
// CLI Interface
// ============================================================================

const videoId = process.argv[2];

if (!videoId) {
  console.error(`Usage: tsx extract-concepts.ts <video_id>`);
  console.error(`Example: tsx extract-concepts.ts kCc8FmEb1nY`);
  process.exit(1);
}

extractConceptsFromVideo(videoId).catch((error) => {
  console.error(`\n❌ Error extracting concepts:`, error);
  process.exit(1);
});
