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
  const DEBUG = process.env.DEBUG_PROCESSING === 'true';
  
  if (DEBUG) {
    console.log(`\n🔍 [SPLIT DEBUG] splitIntoSections called`);
    console.log(`   Input markdown length: ${markdown.length} chars`);
    console.log(`   First 200 chars: ${markdown.substring(0, 200)}`);
    console.log(`   Last 200 chars: ${markdown.substring(markdown.length - 200)}`);
  }
  
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  
  if (DEBUG) {
    console.log(`   Total lines: ${lines.length}`);
  }
  
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
      const sectionContent = currentContent.join('\n').trim();
      if (currentContent.length > 0 && sectionContent.length > 0) {
        sections.push({
          header: currentHeader,
          content: sectionContent,
          headingPath: headingStack.map(h => h.text),
          anchor: generateAnchor(currentHeader),
          startLine: sectionStartLine,
          endLine: lineNum - 1,
        });
      } else if (DEBUG) {
        console.log(`   ⏭️  Skipping empty section: "${currentHeader}"`);
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
  
  if (DEBUG) {
    console.log(`\n🔍 [SPLIT DEBUG] splitIntoSections result`);
    console.log(`   Sections created: ${sections.length}`);
    sections.forEach((s, i) => {
      console.log(`   ${i + 1}. "${s.header}" - ${s.content.length} chars (lines ${s.startLine}-${s.endLine})`);
      if (s.content.length === 0) {
        console.log(`      ⚠️ EMPTY SECTION!`);
      } else {
        console.log(`      Preview: ${s.content.substring(0, 100)}...`);
      }
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
  const DEBUG = process.env.DEBUG_PROCESSING === 'true';
  
  if (DEBUG) {
    console.log(`\n🔍 [PROMPT DEBUG] Building chunking prompt`);
    console.log(`   Markdown length: ${markdown.length} chars`);
    console.log(`   Concepts: ${concepts?.length || 0}`);
    console.log(`   Estimated tokens: ~${Math.ceil(markdown.length / 4)}`);
    
    // Check for potential issues
    const emptyCodeBlocks = (markdown.match(/```python\s*```/g) || []).length;
    if (emptyCodeBlocks > 0) {
      console.log(`   ⚠️ Found ${emptyCodeBlocks} empty code blocks`);
    }
    
    const codeBlockCount = (markdown.match(/```/g) || []).length / 2;
    const textLines = markdown.split('\n').filter(l => l.trim() && !l.startsWith('```')).length;
    console.log(`   Code blocks: ${codeBlockCount}, Text lines: ${textLines}`);
    console.log(`   Ratio: ${codeBlockCount > textLines ? 'CODE-HEAVY' : 'TEXT-HEAVY'}`);
  }
  
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
  const DEBUG = process.env.DEBUG_PROCESSING === 'true';
  
  if (DEBUG) {
    console.log(`\n🔍 [CHUNKER DEBUG] Starting chunkMarkdownFile`);
    console.log(`   Source: ${sourceFile}`);
    console.log(`   Markdown length: ${markdown.length} chars`);
    console.log(`   Concepts provided: ${concepts?.length || 0}`);
  }
  
  // Preprocess: Remove empty code blocks that confuse the model
  const originalLength = markdown.length;
  const emptyCodeBlocks = (markdown.match(/```\w*\s*```/g) || []).length;
  
  if (emptyCodeBlocks > 0) {
    if (DEBUG) {
      console.log(`   🧹 Preprocessing: Found ${emptyCodeBlocks} empty code blocks`);
    }
    markdown = markdown.replace(/```\w*\s*```/g, '');
    if (DEBUG) {
      console.log(`   ✂️  Removed empty code blocks: ${originalLength} → ${markdown.length} chars`);
    }
  }
  
  // Split into sections with provenance metadata
  const sections = splitIntoSections(markdown, sourceFile);
  
  if (DEBUG) {
    console.log(`   Sections found: ${sections.length}`);
    sections.forEach((s, i) => {
      console.log(`     ${i + 1}. "${s.header}" (${s.content.length} chars, lines ${s.startLine}-${s.endLine})`);
    });
  }
  
  onProgress?.('Splitting into sections', 0, sections.length);
  
  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey });
  
  // Process each section
  const allChunks: MarkdownChunk[] = [];
  let chunkIdCounter = 1;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (DEBUG) {
      console.log(`\n🔍 [CHUNKER DEBUG] Processing section ${i + 1}/${sections.length}`);
      console.log(`   Header: "${section.header}"`);
      console.log(`   Content preview: ${section.content.substring(0, 200)}...`);
    }
    
    onProgress?.(`Chunking section: ${section.header}`, i + 1, sections.length);
    
    try {
      const startTime = Date.now();
      const prompt = buildChunkingPrompt(section.content, concepts);
      
      if (DEBUG) {
        console.log(`   🔄 Calling Gemini API (model: gemini-3-flash-preview)...`);
        console.log(`   Prompt length: ${prompt.length} chars`);
        console.log(`   Prompt preview (first 500 chars):\n${prompt.substring(0, 500)}\n...`);
        console.log(`   Prompt preview (last 500 chars):\n...${prompt.substring(prompt.length - 500)}`);
        
        // Save full prompt to file for curl testing
        const fs = await import('fs');
        const promptFile = `/tmp/chunker-prompt-section-${i + 1}.txt`;
        fs.writeFileSync(promptFile, prompt);
        console.log(`   💾 Full prompt saved to: ${promptFile}`);
        
        // Also save curl command
        const curlCmd = `curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \\
  -H "x-goog-api-key: $GEMINI_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -X POST \\
  -d '{
    "contents": [{"parts": [{"text": ${JSON.stringify(prompt)}}]}],
    "generationConfig": {
      "responseMimeType": "application/json",
      "temperature": 0.3
    }
  }'`;
        fs.writeFileSync(`/tmp/chunker-curl-section-${i + 1}.sh`, curlCmd);
        console.log(`   💾 Curl command saved to: /tmp/chunker-curl-section-${i + 1}.sh`);
      }
      
      if (DEBUG) {
        console.log(`   🔄 Calling API with 120s timeout...`);
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: zodToGeminiSchema(chunkResponseSchema),
          temperature: 0.3,
          timeout: 120000, // 120 seconds
        },
      }).catch((error: any) => {
        if (DEBUG) {
          console.log(`   ❌ API call threw error:`, error);
          console.log(`   Error type: ${error.constructor.name}`);
          console.log(`   Error message: ${error.message}`);
          if (error.response) {
            console.log(`   Response status: ${error.response.status}`);
            console.log(`   Response data:`, error.response.data);
          }
        }
        throw error;
      });
      
      const elapsed = Date.now() - startTime;
      
      if (DEBUG) {
        console.log(`   ✅ API call completed in ${elapsed}ms`);
      }
      
      const resultText = response.text;
      if (!resultText) {
        console.warn(`⚠️  No response for section: ${section.header} - skipping`);
        if (DEBUG) {
          console.log(`   Response object:`, response);
        }
        continue;
      }
      
      if (DEBUG) {
        console.log(`   Response length: ${resultText.length} chars`);
        console.log(`   Response preview: ${resultText.substring(0, 200)}...`);
      }
      
      // Parse JSON - responseSchema ensures proper escaping
      const result: { chunks: MarkdownChunk[] } = JSON.parse(resultText);
      
      if (DEBUG) {
        console.log(`   ✅ Parsed ${result.chunks.length} chunks from section`);
        result.chunks.forEach((c, idx) => {
          console.log(`      ${idx + 1}. ${c.chunk_type}: "${c.topic}" (${c.text.length} chars)`);
        });
      }
      
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
        if (DEBUG) {
          console.log(`   ⏳ Rate limiting: waiting 1s before next section...`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Failed to chunk section "${section.header}":`, error);
      if (DEBUG) {
        console.error(`   Error details:`, error);
        console.error(`   Section content length: ${section.content.length}`);
        console.error(`   First 500 chars of section:`, section.content.substring(0, 500));
      }
      // Continue with other sections
    }
  }
  
  if (DEBUG) {
    console.log(`\n🔍 [CHUNKER DEBUG] Chunking complete`);
    console.log(`   Total chunks: ${allChunks.length}`);
    console.log(`   Sections processed: ${sections.length}`);
  }
  
  return allChunks;
}
