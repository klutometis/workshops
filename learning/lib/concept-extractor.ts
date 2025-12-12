import { GoogleGenAI } from "@google/genai";
import { zodToGeminiSchema } from "./gemini-utils.js";
import { conceptGraphSchema, type ConceptGraph } from "../scripts/youtube/types.js";

/**
 * Options for extracting concepts from educational content
 */
export interface ConceptExtractionOptions {
  /** The full text to analyze (transcript, markdown, etc.) */
  text: string;
  
  /** Title of the content */
  title: string;
  
  /** Author/creator of the content */
  author?: string;
  
  /** Source type for context-specific prompting */
  sourceType?: 'youtube' | 'markdown' | 'notebook';
  
  /** Additional metadata to include in the concept graph */
  metadata?: {
    source?: string;
    videoId?: string;
    duration?: number;
    [key: string]: any;
  };
}

/**
 * Build prompt for concept extraction based on content type
 */
function buildConceptPrompt(options: ConceptExtractionOptions): string {
  const { text, title, author, sourceType = 'youtube', metadata = {} } = options;
  
  // Base prompt that works for all content types
  let prompt = `You are an expert at analyzing educational programming content and extracting pedagogical concept graphs.

Analyze this educational content and extract 20-30 salient PEDAGOGICAL concepts that are taught in depth.

IMPORTANT DISTINCTIONS:
- ✅ Extract concepts that are TAUGHT DEEPLY (explained, demonstrated, implemented)
- ❌ Ignore tools that are merely MENTIONED IN PASSING (VS Code, terminal commands, etc.)
- ✅ "Attention Mechanism" - taught over multiple paragraphs with theory + implementation
- ❌ "Git" - mentioned once as a tool used incidentally

For each concept:
1. **Precise pedagogical description** - What is being taught, not just named
2. **Prerequisites** - Based on teaching order and logical dependencies
3. **Difficulty level** - basic/intermediate/advanced based on prerequisites

Guidelines:
- Focus on WHAT IS TAUGHT, not what is used as a tool
- Distinguish between "core concepts" and "implementation details"
- Look for concepts that span multiple sections (theory → implementation → examples)

Content Details:
- Title: "${title}"`;

  if (author) {
    prompt += `\n- Author: "${author}"`;
  }
  
  // Add source-specific context
  if (sourceType === 'youtube' && metadata.duration) {
    const minutes = Math.floor(metadata.duration / 60);
    prompt += `\n- Duration: ${metadata.duration} seconds (${minutes} minutes)`;
    prompt += `\n- Video ID: ${metadata.videoId || 'unknown'}`;
  } else if (sourceType === 'markdown') {
    prompt += `\n- Format: Markdown document`;
  } else if (sourceType === 'notebook') {
    prompt += `\n- Format: Jupyter Notebook`;
  }
  
  if (metadata.source) {
    prompt += `\n- Source: ${metadata.source}`;
  }
  
  prompt += `\n\nCONTENT:\n${text}\n\nReturn a complete concept graph with metadata and 20-30 pedagogical concepts.`;
  
  return prompt;
}

/**
 * Extract pedagogical concepts from educational content
 * 
 * This is the core concept extraction logic, format-agnostic and reusable
 * for any text-based educational content (video transcripts, markdown, notebooks, etc.)
 * 
 * @param options - Configuration for concept extraction
 * @returns Promise<ConceptGraph> - Structured concept graph with nodes and edges
 * 
 * @example
 * ```typescript
 * const concepts = await extractConcepts({
 *   text: fullTranscript,
 *   title: "Building GPT from Scratch",
 *   author: "Andrej Karpathy",
 *   sourceType: 'youtube',
 *   metadata: { videoId: 'kCc8FmEb1nY', duration: 11400 }
 * });
 * ```
 */
export async function extractConcepts(
  options: ConceptExtractionOptions
): Promise<ConceptGraph> {
  const { text, title, author, sourceType = 'youtube', metadata = {} } = options;
  
  // Validate inputs
  if (!text || text.trim().length === 0) {
    throw new Error('Text content is required for concept extraction');
  }
  
  if (!title || title.trim().length === 0) {
    throw new Error('Title is required for concept extraction');
  }
  
  // Initialize Gemini
  const ai = new GoogleGenAI({});
  
  // Build prompt
  const prompt = buildConceptPrompt(options);
  
  // Call Gemini with structured output
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToGeminiSchema(conceptGraphSchema),
    },
  });
  
  if (!response.text) {
    throw new Error("No response text received from Gemini");
  }
  
  // Parse and validate response
  let conceptGraph: ConceptGraph;
  try {
    conceptGraph = conceptGraphSchema.parse(JSON.parse(response.text));
  } catch (error: any) {
    throw new Error(`Failed to parse concept graph: ${error.message}\n\nResponse snippet: ${response.text.slice(0, 500)}`);
  }
  
  // Enrich metadata
  conceptGraph.metadata.extracted_at = new Date().toISOString();
  conceptGraph.metadata.total_concepts = conceptGraph.nodes.length;
  
  // Merge in provided metadata
  conceptGraph.metadata = {
    ...conceptGraph.metadata,
    ...metadata,
  };
  
  return conceptGraph;
}
