/**
 * Fetch video metadata from YouTube
 * 
 * Usage:
 *   npx ts-node scripts/youtube/fetch-video-info.ts x7X9w_GIm1s
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

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

async function fetchVideoInfo(videoId: string): Promise<void> {
  console.log(`📹 Fetching video metadata for: ${videoId}`);
  console.log(`🔗 URL: https://www.youtube.com/watch?v=${videoId}\n`);

  try {
    // Use yt-dlp to fetch video metadata as JSON
    const metadata = execSync(
      `uvx --from yt-dlp yt-dlp --dump-json "https://www.youtube.com/watch?v=${videoId}"`,
      { 
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );

    const videoData = JSON.parse(metadata);

    // Extract the fields we care about
    const videoInfo: VideoInfo = {
      video_id: videoId,
      title: videoData.title,
      author: videoData.uploader || videoData.channel,
      channel: videoData.channel || videoData.uploader,
      duration: videoData.duration,
      upload_date: videoData.upload_date,
      description: videoData.description || '',
      view_count: videoData.view_count || 0,
      fetched_at: new Date().toISOString(),
    };

    console.log(`✅ Video metadata fetched:\n`);
    console.log(`   Title: ${videoInfo.title}`);
    console.log(`   Author: ${videoInfo.author}`);
    console.log(`   Channel: ${videoInfo.channel}`);
    console.log(`   Duration: ${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s`);
    console.log(`   Uploaded: ${videoInfo.upload_date}`);
    console.log(`   Views: ${videoInfo.view_count.toLocaleString()}\n`);

    // Save to file
    const outputDir = path.join(process.cwd(), 'youtube', videoId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, 'video-info.json');
    await fs.writeFile(
      outputFile,
      JSON.stringify(videoInfo, null, 2)
    );

    console.log(`💾 Saved video info to: ${outputFile}`);

  } catch (error: any) {
    console.error('❌ Error fetching video info:', error.message);
    throw error;
  }
}

// Main execution
const videoId = process.argv[2];

if (!videoId) {
  console.error(`Usage: tsx fetch-video-info.ts <video_id>`);
  console.error(`Example: tsx fetch-video-info.ts x7X9w_GIm1s`);
  process.exit(1);
}

fetchVideoInfo(videoId)
  .then(() => {
    console.log('\n✨ Done!');
  })
  .catch(err => {
    console.error('\n💥 Failed:', err.message);
    process.exit(1);
  });
