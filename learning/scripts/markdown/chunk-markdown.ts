#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { chunkMarkdownFile } from "../../lib/markdown-chunker.js";

async function main() {
  const markdownPath = process.argv[2];
  
  if (!markdownPath) {
    console.error('Usage: tsx chunk-markdown.ts <markdown-file>');
    console.error('Example: tsx chunk-markdown.ts public/data/pytudes/tsp.md');
    console.error('\nNOTE: Run extract-concepts.ts FIRST to generate canonical concept IDs.');
    process.exit(1);
  }
  
  console.log('📝 Markdown Chunker');
  console.log('━'.repeat(50));
  console.log(`📄 Input: ${markdownPath}\n`);
  
  // Check file exists
  if (!fs.existsSync(markdownPath)) {
    console.error(`❌ File not found: ${markdownPath}`);
    process.exit(1);
  }
  
  // Setup output directory - use the directory where the markdown file actually is
  const markdownDir = path.dirname(markdownPath);
  
  if (!fs.existsSync(markdownDir)) {
    fs.mkdirSync(markdownDir, { recursive: true });
  }
  
  // Try to load pre-extracted concepts (recommended workflow)
  const conceptGraphPath = path.join(markdownDir, 'concept-graph.json');
  let concepts: Array<{ id: string; name: string; description: string }> | undefined;
  
  if (fs.existsSync(conceptGraphPath)) {
    console.log('✅ Found pre-extracted concepts - using canonical IDs\n');
    const conceptGraph = JSON.parse(fs.readFileSync(conceptGraphPath, 'utf-8'));
    concepts = conceptGraph.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      description: n.description,
    }));
  } else {
    console.log('⚠️  No concept-graph.json found');
    console.log('   Chunker will generate concept IDs independently');
    console.log('   For best results: run extract-concepts.ts first!\n');
  }
  
  // Read markdown
  const markdown = fs.readFileSync(markdownPath, 'utf-8');
  
  // Get API key
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY or GEMINI_API_KEY not set');
    process.exit(1);
  }
  
  // Chunk the document
  console.log('🧠 Chunking document...\n');
  const startTime = Date.now();
  
  const chunks = await chunkMarkdownFile(
    markdown,
    markdownPath,
    apiKey,
    (stage, current, total) => {
      console.log(`   [${current}/${total}] ${stage}`);
    },
    concepts  // Pass canonical concepts if available
  );
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Save with metadata (format expected by extract-concepts.ts)
  const output = {
    chunks,
    metadata: {
      total_chunks: chunks.length,
      source_file: markdownPath,
      chunked_at: new Date().toISOString(),
    },
  };
  
  const outputPath = path.join(markdownDir, 'chunks.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Chunking complete in ${duration}s`);
  console.log(`📊 Total chunks: ${chunks.length}`);
  console.log(`💾 Saved to: ${outputPath}\n`);
}

main().catch(error => {
  console.error('\n❌ Chunking failed:', error);
  process.exit(1);
});
