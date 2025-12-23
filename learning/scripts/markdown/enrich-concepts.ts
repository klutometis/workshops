import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { zodToGeminiSchema } from "../../lib/gemini-utils.js";
import { pedagogicalEnrichmentSchema, type PedagogicalEnrichment } from "../../lib/pedagogical-schemas.js";

// ============================================================================
// Schemas
// ============================================================================

const enrichedConceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  
  // Markdown-specific: relevant chunks instead of time_ranges
  relevant_chunks: z.array(z.object({
    chunk_id: z.string(),
    heading_path: z.array(z.string()),
    excerpt: z.string(),
  })),
  
  // Pedagogical enrichment
  learning_objectives: z.array(z.string()),
  mastery_indicators: z.array(z.object({
    skill: z.string(),
    description: z.string(),
    difficulty: z.enum(["basic", "intermediate", "advanced"]),
    test_method: z.string(),
  })),
  misconceptions: z.array(z.object({
    misconception: z.string(),
    reality: z.string(),
    correction_strategy: z.string(),
  })),
  key_insights: z.array(z.string()),
  practical_applications: z.array(z.string()).optional(),
  common_gotchas: z.array(z.string()).optional(),
  debugging_tips: z.array(z.string()).optional(),
});

type EnrichedConcept = z.infer<typeof enrichedConceptSchema>;

// ============================================================================
// Load Input Data
// ============================================================================

function loadConceptGraph(workDir: string): any {
  const conceptPath = path.join(workDir, "concept-graph.json");
  return JSON.parse(fs.readFileSync(conceptPath, "utf-8"));
}

function loadChunks(workDir: string): any {
  const chunksPath = path.join(workDir, "chunks.json");
  return JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
}

function loadMarkdown(markdownPath: string): string {
  return fs.readFileSync(markdownPath, "utf-8");
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRelevantChunksForConcept(conceptId: string, conceptName: string, chunks: any): any[] {
  // Find chunks that mention this concept (by ID in concepts array or by name in text)
  const relevantChunks = chunks.chunks.filter((chunk: any) => {
    // Both scripts now use kebab-case, so direct ID comparison works
    const conceptsMatch = chunk.concepts && chunk.concepts.includes(conceptId);
    const textMatch = chunk.text.toLowerCase().includes(conceptName.toLowerCase());
    return conceptsMatch || textMatch;
  });
  
  return relevantChunks.map((chunk: any) => ({
    chunk_id: chunk.chunk_id,
    heading_path: chunk.heading_path,
    text: chunk.text,
    chunk_type: chunk.chunk_type,
  }));
}

// ============================================================================
// Build Enrichment Prompt
// ============================================================================

function buildEnrichmentPrompt(
  concept: any,
  relevantChunks: any[],
  fullMarkdown: string,
  prerequisites: any[]
): string {
  const prerequisiteNames = prerequisites
    .filter(p => p)
    .map(p => p.name)
    .join(", ");
  
  const chunksText = relevantChunks.length > 0
    ? relevantChunks
        .map(chunk => `
**Section: ${chunk.heading_path.join(" → ")}** (${chunk.chunk_type})

${chunk.text}
`)
        .join("\n---\n")
    : "No specific sections identified for this concept.";

  return `You are designing comprehensive pedagogical metadata for a programming concept from a technical tutorial document.

**Concept:**
${concept.name}
Description: ${concept.description}
Difficulty Level: ${concept.difficulty}
Prerequisites: ${prerequisiteNames || "None"}

**Full document context:**
${fullMarkdown.substring(0, 50000)} ${fullMarkdown.length > 50000 ? '...(truncated)' : ''}

**Sections most relevant to this concept:**
${chunksText}

**Your task:**
Generate comprehensive pedagogical enrichment that will power an interactive Socratic learning system.

1. **Learning Objectives** (3-5 specific, measurable goals)
   - Start with action verbs: "Explain...", "Implement...", "Identify...", "Debug...", "Apply..."
   - Make them specific to what the document actually teaches
   - Progress from understanding → application → mastery

2. **Mastery Indicators** (3-6 assessable skills)
   - CRITICAL: These determine when students can unlock dependent concepts
   - Progress: basic → intermediate → advanced
   - Each needs: skill identifier, description, difficulty, concrete test method
   - Test methods must be actionable in Socratic dialogue (questions to ask, code to write, etc.)
   - Think: "How would I know the student truly understands this?"

3. **Common Misconceptions** (2-4 realistic errors)
   - What do beginners actually get wrong about this?
   - Include: the misconception, the reality, and how to correct it
   - Ground in actual content if the document addresses these

4. **Key Insights** (2-4 fundamental truths)
   - The "aha moments" that make this concept click
   - Memorable, foundational understanding
   - Often things the author explicitly emphasizes

**Optional enrichment (add if relevant):**
- practical_applications: Real-world uses beyond this tutorial
- common_gotchas: Tricky implementation details or edge cases
- debugging_tips: How to diagnose and fix issues with this concept

**Guidelines:**
- Be authentic to the document's teaching approach and content
- Reference actual examples when relevant (use section headings)
- Make mastery indicators TESTABLE via dialogue (not vague)
- Misconceptions should be realistic for someone learning this topic
- Balance rigor with accessibility

Return valid JSON matching the schema.`.trim();
}

// ============================================================================
// Enrich Single Concept
// ============================================================================

async function enrichConcept(
  concept: any,
  chunks: any,
  fullMarkdown: string,
  conceptGraph: any,
  ai: any
): Promise<EnrichedConcept> {
  console.log(`\n📚 Enriching: ${concept.name}`);
  
  // 1. Find relevant chunks for this concept
  const relevantChunks = getRelevantChunksForConcept(concept.id, concept.name, chunks);
  console.log(`   📝 Found ${relevantChunks.length} relevant chunks`);
  
  // 2. Get prerequisite concepts for context
  const prerequisites = concept.prerequisites.map((preqId: string) =>
    conceptGraph.nodes.find((n: any) => n.id === preqId)
  );
  
  // 3. Build prompt with all context
  const prompt = buildEnrichmentPrompt(
    concept,
    relevantChunks,
    fullMarkdown,
    prerequisites
  );
  
  // 4. Call Gemini with structured output
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToGeminiSchema(pedagogicalEnrichmentSchema),
    },
  });
  
  const pedagogicalEnrichment = pedagogicalEnrichmentSchema.parse(JSON.parse(response.text));
  
  console.log(`   ✅ ${pedagogicalEnrichment.learning_objectives.length} learning objectives`);
  console.log(`   ✅ ${pedagogicalEnrichment.mastery_indicators.length} mastery indicators`);
  console.log(`   ✅ ${pedagogicalEnrichment.misconceptions.length} misconceptions`);
  console.log(`   ✅ ${pedagogicalEnrichment.key_insights.length} key insights`);
  
  // 5. Merge: original metadata + relevant chunks + pedagogical enrichment
  const enriched: EnrichedConcept = {
    id: concept.id,
    name: concept.name,
    description: concept.description,
    prerequisites: concept.prerequisites,
    difficulty: concept.difficulty,
    relevant_chunks: relevantChunks.map(chunk => ({
      chunk_id: chunk.chunk_id,
      heading_path: chunk.heading_path,
      excerpt: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
    })),
    ...pedagogicalEnrichment,
  };
  
  return enriched;
}

// ============================================================================
// Main Processing Loop
// ============================================================================

async function enrichConcepts(markdownPath: string): Promise<void> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const workDir = path.dirname(markdownPath);
  console.log(`🎓 Enriching concepts in: ${workDir}\n`);
  
  // Load all inputs
  const conceptGraph = loadConceptGraph(workDir);
  const chunks = loadChunks(workDir);
  const fullMarkdown = loadMarkdown(markdownPath);
  
  console.log(`📊 Loaded:`);
  console.log(`   - ${conceptGraph.nodes.length} concepts`);
  console.log(`   - ${chunks.chunks.length} chunks`);
  console.log(`   - Full markdown (${Math.round(fullMarkdown.length / 1000)}k chars)`);
  
  const enrichedConcepts: EnrichedConcept[] = [];
  
  // Process each concept
  for (const concept of conceptGraph.nodes) {
    try {
      const enriched = await enrichConcept(
        concept,
        chunks,
        fullMarkdown,
        conceptGraph,
        ai
      );
      
      enrichedConcepts.push(enriched);
      
      // Rate limiting: small delay between concepts
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Failed to enrich ${concept.name}:`, error);
      // Continue with other concepts even if one fails
    }
  }
  
  // Save enriched concept graph
  const outputPath = path.join(workDir, "concept-graph-enriched.json");
  
  const enrichedGraph = {
    metadata: {
      ...conceptGraph.metadata,
      enriched_at: new Date().toISOString(),
      enrichment_version: "1.0",
    },
    nodes: enrichedConcepts,
    edges: conceptGraph.edges,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(enrichedGraph, null, 2));
  
  console.log(`\n✅ Enrichment complete!`);
  console.log(`📄 Saved to: ${outputPath}`);
  console.log(`\n📈 Summary:`);
  console.log(`   - ${enrichedConcepts.length} concepts enriched`);
  console.log(`   - ${enrichedConcepts.reduce((sum, c) => sum + c.learning_objectives.length, 0)} total learning objectives`);
  console.log(`   - ${enrichedConcepts.reduce((sum, c) => sum + c.mastery_indicators.length, 0)} total mastery indicators`);
  console.log(`   - ${enrichedConcepts.reduce((sum, c) => sum + c.misconceptions.length, 0)} total misconceptions`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const markdownPath = process.argv[2];
  
  if (!markdownPath) {
    console.error("Usage: npx tsx scripts/markdown/enrich-concepts.ts <markdown-path>");
    console.error("\nExample: npx tsx scripts/markdown/enrich-concepts.ts public/data/pytudes/tsp.md");
    process.exit(1);
  }
  
  await enrichConcepts(markdownPath);
}

main().catch(console.error);
