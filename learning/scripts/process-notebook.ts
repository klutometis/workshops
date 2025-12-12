#!/usr/bin/env node
/**
 * CLI tool to process Jupyter notebooks into learning modules
 * 
 * Usage:
 *   npx tsx scripts/process-notebook.ts <notebook-file-path>
 * 
 * Examples:
 *   npx tsx scripts/process-notebook.ts ../pytudes/ipynb/Advent-2020.ipynb
 *   npx tsx scripts/process-notebook.ts ./notebooks/tutorial.ipynb
 */

import { processJupyterNotebook, ProcessingError } from '../lib/processing';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Jupyter notebook file path required\n');
    console.error('Usage: npx tsx scripts/process-notebook.ts <notebook-file-path>\n');
    console.error('Examples:');
    console.error('  npx tsx scripts/process-notebook.ts ../pytudes/ipynb/Advent-2020.ipynb');
    console.error('  npx tsx scripts/process-notebook.ts ./notebooks/tutorial.ipynb');
    process.exit(1);
  }
  
  const filePath = path.resolve(args[0]);
  
  console.log('📓 Jupyter Notebook Processor');
  console.log('━'.repeat(50));
  console.log(`📄 Input: ${filePath}\n`);
  
  const startTime = Date.now();
  
  try {
    const result = await processJupyterNotebook(filePath, (stage, percent, message) => {
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
    console.log(`⏱️  Processing time: ${duration}s`);
    console.log(`📄 Source: ${result.metadata.sourceFile}`);
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
    console.error('  - Check that the file path exists and is readable');
    console.error('  - Ensure the file is valid .ipynb format');
    console.error('  - Verify API keys are configured (GEMINI_API_KEY)');
    console.error('  - Check database connection is working');
    
    process.exit(1);
  }
}

main();
