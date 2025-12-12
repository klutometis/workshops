/**
 * Markdown Chunker - Semantic segmentation of markdown documents
 * 
 * Extracts chunking logic from chunk-paip.ts to make it reusable
 * across different processing pipelines (YouTube, Markdown, Notebooks).
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToGeminiSchema } from "./gemini-utils";

/**
 * Zod schema for chunk response from Gemini
 * Using explicit schema ensures proper JSON escaping of control characters
 */
const chunkSchema = z.object({
  chunk_id: z.string(),
  topic: z.string(),
  text: z.string(),
  concepts: z.array(z.string()),
  chunk_type: z.enum(['definition', 'example', 'explanation', 'exercise', 'overview']),
  section: z.string().optional(),
});

const chunkResponseSchema = z.object({
  chunks: z.array(chunkSchema),
});

/**
 * A semantically meaningful chunk of markdown content with provenance metadata
 */
export interface MarkdownChunk {
  chunk_id: string;
  topic: string;
  text: string;
  concepts: string[];
  chunk_type: 'definition' | 'example' | 'explanation' | 'exercise' | 'overview';
  section?: string;
  
  // Provenance metadata for linking back to source
  source_file: string;
  heading_path: string[];
  markdown_anchor: string;
  start_line: number;
  end_line: number;
}

/**
 * A section of the document split by h1 headers
 */
interface Section {
  header: string;
  content: string;
  headingPath: string[];
  anchor: string;
  startLine: number;
  endLine: number;
}

/**
 * Generate GitHub-style markdown anchors
 */
function generateAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-');      // Replace spaces with hyphens
}

/**
 * Extract heading level and text from a markdown heading line
 */
function parseHeading(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

/**
 * Split document into sections by h1 headers with provenance metadata
 */
function splitIntoSections(markdown: string, sourceFile: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  
  let currentHeader = 'Introduction';
  let currentContent: string[] = [];
  let headingStack: Array<{ level: number; text: string }> = [];
  let sectionStartLine = 0;
  let insideCodeFence = false;  // Track whether we're inside a code block
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    // Track code fence state (```)
    if (line.trim().startsWith('```')) {
      insideCodeFence = !insideCodeFence;
    }
    
    // Only parse headings when NOT inside a code fence
    const heading = !insideCodeFence ? parseHeading(line) : null;
    
    if (heading && heading.level === 1) {  // Main section header
      // Save previous section if it has content
      if (currentContent.length > 0) {
        sections.push({
          header: currentHeader,
          content: currentContent.join('\n').trim(),
          headingPath: headingStack.map(h => h.text),
          anchor: generateAnchor(currentHeader),
          startLine: sectionStartLine,
          endLine: lineNum - 1,
        });
      }
      
      // Start new section
      currentHeader = heading.text;
      headingStack = [{ level: heading.level, text: heading.text }];
      currentContent = [line]; // Include the header in content
      sectionStartLine = lineNum;
    } else {
      // Update heading stack for sub-headers
      if (heading) {
        // Pop any headers at the same or deeper level
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= heading.level) {
          headingStack.pop();
        }
        headingStack.push({ level: heading.level, text: heading.text });
      }
      
      currentContent.push(line);
    }
  }
  
  // Add final section
  if (currentContent.length > 0) {
    sections.push({
      header: currentHeader,
      content: currentContent.join('\n').trim(),
      headingPath: headingStack.map(h => h.text),
      anchor: generateAnchor(currentHeader),
      startLine: sectionStartLine,
      endLine: lines.length - 1,
    });
  }
  
  return sections;
}

/**
 * Build prompt for Gemini to semantically chunk a section
 */
function buildChunkingPrompt(
  markdown: string, 
  concepts?: Array<{ id: string; name: string; description: string }>
): string {
  const conceptsContext = concepts && concepts.length > 0
    ? `
**CANONICAL CONCEPT IDs (use these EXACT IDs, do not invent new ones):**
${concepts.map(c => `- ${c.id}: ${c.name} - ${c.description.substring(0, 100)}...`).join('\n')}

When tagging chunks with concepts, ONLY use the IDs listed above. Do not create new concept IDs.
`
    : `
**CONCEPT TAGGING:**
Identify key concepts and tag them with meaningful IDs (e.g., "functional-programming", "recursion", "data-structures").
Extract concepts directly from the content - be specific and use the terminology from the document.
`;

  return `You are a content analyzer. Your task is to semantically chunk this document into meaningful, self-contained units.

**CHUNKING RULES:**
1. Each chunk should be a complete, self-contained unit of information
2. Keep related content together: concept definition → explanation → example
3. Ideal chunk size: 300-800 tokens (roughly 1-3 paragraphs)
4. Split at natural boundaries: topic changes, section breaks, before new concepts
5. Code examples should stay with their explanations
6. Don't split mid-concept or mid-example

**CHUNK TYPES:**
- "definition": Formal definition or introduction of a new concept
- "example": Code examples with explanations
- "explanation": Deep dive into how/why something works
- "exercise": Practice problems or challenges
- "overview": Section introductions or summaries

${conceptsContext}

Here's the markdown to chunk:

---
${markdown}
---

Return a JSON object with this structure:
{
  "chunks": [
    {
      "chunk_id": "unique-kebab-case-id",
      "topic": "Brief topic description",
      "text": "The actual chunk text (preserve markdown formatting)",
      "concepts": ["concept-id-1", "concept-id-2"],
      "chunk_type": "definition" | "example" | "explanation" | "exercise" | "overview",
      "section": "1.1" (if identifiable from headers)
    }
  ]
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown code fences
- Include ALL the text, don't summarize or skip content
- Preserve code blocks exactly as they appear
`;
}

/**
 * Chunk a markdown file into semantically meaningful segments
 * 
 * Process:
 * 1. Split document into sections by h1 headers
 * 2. For each section, ask Gemini to semantically chunk it
 * 3. Add provenance metadata to each chunk
 * 4. Return all chunks with metadata
 * 
 * @param markdown - The markdown content to chunk
 * @param sourceFile - Original filename for provenance
 * @param apiKey - Google AI API key
 * @param concepts - Optional: Pre-extracted concepts to reference (recommended to avoid ID mismatches)
 * @returns Array of semantically chunked segments with provenance
 */
export async function chunkMarkdownFile(
  markdown: string,
  sourceFile: string,
  apiKey: string,
  onProgress?: (stage: string, current: number, total: number) => void,
  concepts?: Array<{ id: string; name: string; description: string }>
): Promise<MarkdownChunk[]> {
  // Split into sections with provenance metadata
  const sections = splitIntoSections(markdown, sourceFile);
  
  onProgress?.('Splitting into sections', 0, sections.length);
  
  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey });
  
  // Process each section
  const allChunks: MarkdownChunk[] = [];
  let chunkIdCounter = 1;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    onProgress?.(`Chunking section: ${section.header}`, i + 1, sections.length);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: buildChunkingPrompt(section.content, concepts),
        config: {
          responseMimeType: 'application/json',
          responseSchema: zodToGeminiSchema(chunkResponseSchema),
          temperature: 0.3,
        },
      });
      
      const resultText = response.text;
      if (!resultText) {
        console.warn(`No response for section: ${section.header} - skipping`);
        continue;
      }
      
      // Parse JSON - responseSchema ensures proper escaping
      const result: { chunks: MarkdownChunk[] } = JSON.parse(resultText);
      
      // Add provenance metadata and ensure unique IDs
      result.chunks.forEach(chunk => {
        chunk.chunk_id = `chunk-${chunkIdCounter++}-${chunk.chunk_id}`;
        chunk.section = section.header;
        chunk.source_file = sourceFile;
        chunk.heading_path = section.headingPath;
        chunk.markdown_anchor = section.anchor;
        chunk.start_line = section.startLine;
        chunk.end_line = section.endLine;
      });
      
      allChunks.push(...result.chunks);
      
      // Rate limiting - be nice to the API
      if (i < sections.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Failed to chunk section "${section.header}":`, error);
      // Continue with other sections
    }
  }
  
  return allChunks;
}
