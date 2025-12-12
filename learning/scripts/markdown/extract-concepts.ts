import * as fs from "fs";
import * as path from "path";
import { extractConcepts } from "../../lib/concept-extractor.js";

// ============================================================================
// Main Extraction Logic
// ============================================================================

async function extractConceptsFromMarkdown(markdownPath: string): Promise<void> {
  console.log(`\n🎓 CONCEPT EXTRACTION`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📄 Markdown file: ${markdownPath}\n`);

  // Check if markdown file exists
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`❌ Markdown file not found: ${markdownPath}`);
  }

  // Paths
  const basename = path.basename(markdownPath, '.md');
  const markdownDir = path.join(process.cwd(), "markdown", basename);
  const outputPath = path.join(markdownDir, "concept-graph.json");

  // Create output directory
  if (!fs.existsSync(markdownDir)) {
    fs.mkdirSync(markdownDir, { recursive: true });
  }

  // Read the full markdown file
  console.log(`📖 Reading markdown file...`);
  const fullText = fs.readFileSync(markdownPath, "utf-8");

  console.log(`   File length: ${fullText.length} characters\n`);

  // Extract concepts using shared library
  console.log(`🔮 Extracting concepts using shared library...`);
  console.log(`   (This may take 30-60 seconds for a long document)\n`);

  const startTime = Date.now();

  // Derive title from filename (convert tsp → TSP, etc.)
  const title = basename.toUpperCase();
  
  const conceptGraph = await extractConcepts({
    text: fullText,
    title: title,
    author: "Unknown", // Could parse from markdown frontmatter later
    sourceType: 'markdown',
    metadata: {
      source_file: markdownPath,
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

const markdownPath = process.argv[2];

if (!markdownPath) {
  console.error(`Usage: tsx extract-concepts.ts <markdown_file>`);
  console.error(`Example: tsx extract-concepts.ts public/data/pytudes/tsp.md`);
  process.exit(1);
}

extractConceptsFromMarkdown(markdownPath).catch((error) => {
  console.error(`\n❌ Error extracting concepts:`, error);
  process.exit(1);
});
