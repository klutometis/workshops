#!/usr/bin/env node
/**
 * Test script for markdown-chunker.ts
 * 
 * Usage:
 *   npx tsx scripts/test-chunker.ts <markdown-file>
 * 
 * Example:
 *   npx tsx scripts/test-chunker.ts ../pytudes/ipynb/TSP.md
 */

import { chunkMarkdownFile } from '../lib/markdown-chunker';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Markdown file path required\n');
    console.error('Usage: npx tsx scripts/test-chunker.ts <markdown-file>\n');
    console.error('Example:');
    console.error('  npx tsx scripts/test-chunker.ts ../pytudes/ipynb/TSP.md');
    process.exit(1);
  }
  
  const filePath = path.resolve(args[0]);
  const fileName = path.basename(filePath);
  
  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log('🤖 Markdown Chunker Test\n');
  console.log(`📖 Reading ${fileName}...`);
  
  const markdown = fs.readFileSync(filePath, 'utf-8');
  console.log(`✅ Loaded ${markdown.length} characters\n`);
  
  // Get API key
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY or GEMINI_API_KEY not found in environment!');
    process.exit(1);
  }
  
  // Chunk the document
  console.log('🧠 Chunking document...\n');
  
  const startTime = Date.now();
  
  const chunks = await chunkMarkdownFile(
    markdown,
    fileName,
    apiKey,
    (stage, current, total) => {
      console.log(`   [${current}/${total}] ${stage}`);
    }
  );
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n✅ Chunking complete in ${duration}s\n`);
  
  // Display summary
  console.log('📊 Summary:');
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Avg length: ${Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)} chars`);
  
  const types = [...new Set(chunks.map(c => c.chunk_type))];
  console.log(`   Chunk types: ${types.join(', ')}`);
  
  const allConcepts = [...new Set(chunks.flatMap(c => c.concepts))];
  console.log(`   Unique concepts: ${allConcepts.length}`);
  
  // Display samples
  console.log('\n📝 Sample Chunks:\n');
  
  const samples = [
    chunks[0], // First
    chunks[Math.floor(chunks.length / 2)], // Middle
    chunks[chunks.length - 1], // Last
  ];
  
  samples.forEach((chunk, i) => {
    console.log(`${'='.repeat(80)}`);
    console.log(`Sample ${i + 1}/${samples.length}`);
    console.log(`ID: ${chunk.chunk_id}`);
    console.log(`Topic: ${chunk.topic}`);
    console.log(`Type: ${chunk.chunk_type}`);
    console.log(`Concepts: ${chunk.concepts.join(', ')}`);
    console.log(`Location: ${chunk.heading_path.join(' > ')}`);
    console.log(`Anchor: #${chunk.markdown_anchor}`);
    console.log(`Lines: ${chunk.start_line}-${chunk.end_line}`);
    console.log(`Length: ${chunk.text.length} chars`);
    console.log(`\nPreview:\n${chunk.text.substring(0, 300)}...`);
    console.log();
  });
  
  // Save output
  const outputPath = filePath.replace(/\.md$/, '-chunks-test.json');
  fs.writeFileSync(outputPath, JSON.stringify({ chunks }, null, 2));
  console.log(`💾 Saved chunks to: ${outputPath}\n`);
  
  console.log('✨ Test complete!\n');
}

main().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  if (error.stack) {
    console.error('\nStack trace:', error.stack);
  }
  process.exit(1);
});
