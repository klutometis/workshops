#!/usr/bin/env node
/**
 * CLI tool to process YouTube videos into learning modules
 * 
 * Usage:
 *   npx tsx scripts/process-youtube.ts <youtube-url-or-id>
 * 
 * Examples:
 *   npx tsx scripts/process-youtube.ts https://www.youtube.com/watch?v=kCc8FmEb1nY
 *   npx tsx scripts/process-youtube.ts kCc8FmEb1nY
 */

import { processYouTubeVideo, ProcessingError } from '../lib/processing';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: YouTube URL or video ID required\n');
    console.error('Usage: npx tsx scripts/process-youtube.ts <youtube-url-or-id>\n');
    console.error('Examples:');
    console.error('  npx tsx scripts/process-youtube.ts https://www.youtube.com/watch?v=kCc8FmEb1nY');
    console.error('  npx tsx scripts/process-youtube.ts kCc8FmEb1nY');
    process.exit(1);
  }
  
  const urlOrId = args[0];
  
  console.log('🎬 YouTube Video Processor');
  console.log('━'.repeat(50));
  console.log(`📹 Input: ${urlOrId}\n`);
  
  const startTime = Date.now();
  
  try {
    const result = await processYouTubeVideo(urlOrId, (stage, percent, message) => {
      const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
      const msg = message ? ` - ${message}` : '';
      console.log(`[${bar}] ${percent}% ${stage}${msg}`);
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ Processing Complete!');
    console.log('━'.repeat(50));
    console.log(`📚 Library ID: ${result.libraryId}`);
    console.log(`📖 Title: ${result.title}`);
    console.log(`🔗 Slug: ${result.slug}`);
    console.log(`📊 Stats:`);
    console.log(`   - Concepts: ${result.stats.conceptCount}`);
    console.log(`   - Segments: ${result.stats.segmentCount}`);
    console.log(`   - Embeddings: ${result.stats.embeddingCount}`);
    if (result.stats.duration) {
      console.log(`   - Duration: ${result.stats.duration}s`);
    }
    console.log(`⏱️  Processing time: ${duration}s`);
    console.log(`🔗 Source: ${result.metadata.sourceUrl}`);
    console.log('\n🎓 Ready for learning at: http://localhost:3000');
    
  } catch (error: any) {
    console.error('\n❌ Processing Failed!');
    console.error('━'.repeat(50));
    
    if (error instanceof ProcessingError) {
      console.error(`Stage: ${error.stage}`);
      console.error(`Error: ${error.message}`);
      if (error.originalError) {
        console.error(`\nDetails: ${error.originalError.message}`);
      }
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    console.error('\n💡 Tips:');
    console.error('  - Check that the YouTube URL is valid and accessible');
    console.error('  - Ensure you have API keys configured (GOOGLE_API_KEY)');
    console.error('  - Verify database connection is working');
    console.error('  - Check logs above for specific error details');
    
    process.exit(1);
  }
}

main();
