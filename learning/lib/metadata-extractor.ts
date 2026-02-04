/**
 * Metadata Extractor - Extract title, description, author from educational content
 * 
 * Uses LLM to analyze the full document and extract high-quality metadata.
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToGeminiSchema } from "./gemini-utils";

/**
 * Metadata schema
 */
const metadataSchema = z.object({
  title: z.string().describe("Clear, descriptive title (50 chars max). Use the document's actual title if present."),
  description: z.string().describe("1-2 sentence summary of what the learner will learn (200 chars max). Focus on outcomes, not just topics."),
  author: z.string().optional().describe("Author name if identifiable from the content. Return null if not found."),
  topics: z.array(z.string()).describe("3-5 main topics covered (e.g., 'Python basics', 'Functions', 'Loops')"),
  level: z.enum(['beginner', 'intermediate', 'advanced']).describe("Difficulty level based on prerequisites and complexity"),
  estimated_hours: z.number().optional().describe("Rough estimate of learning time in hours based on content depth"),
});

export type DocumentMetadata = z.infer<typeof metadataSchema>;

/**
 * Extract metadata from educational content
 * 
 * @param markdown - Full markdown content
 * @param sourceUrl - Original source URL (may contain author info)
 * @param apiKey - Google AI API key
 * @returns Extracted metadata
 */
export async function extractMetadata(
  markdown: string,
  sourceUrl: string,
  apiKey: string
): Promise<DocumentMetadata> {
  const ai = new GoogleGenAI({ apiKey });
  
  // Try to extract author from URL (GitHub, etc.)
  const urlAuthor = extractAuthorFromUrl(sourceUrl);
  
  const prompt = buildMetadataPrompt(markdown, sourceUrl, urlAuthor);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: zodToGeminiSchema(metadataSchema),
      temperature: 0.3,
      timeout: 30000, // 30 seconds
    },
  });
  
  const metadata = metadataSchema.parse(JSON.parse(response.text));
  
  // Use URL-extracted author if LLM didn't find one
  if (!metadata.author && urlAuthor) {
    metadata.author = urlAuthor;
  }
  
  return metadata;
}

/**
 * Try to extract author from source URL
 */
function extractAuthorFromUrl(url: string): string | null {
  // GitHub URLs
  const githubMatch = url.match(/github\.com\/([^\/]+)/);
  if (githubMatch) {
    return githubMatch[1].replace(/-/g, ' '); // "peter-norvig" -> "peter norvig"
  }
  
  // Raw GitHub URLs
  const rawGithubMatch = url.match(/raw\.githubusercontent\.com\/([^\/]+)/);
  if (rawGithubMatch) {
    return rawGithubMatch[1].replace(/-/g, ' ');
  }
  
  return null;
}

/**
 * Build prompt for metadata extraction
 */
function buildMetadataPrompt(markdown: string, sourceUrl: string, urlAuthor: string | null): string {
  // Truncate markdown if too long (keep first and last parts)
  const maxChars = 50000;
  let contentSample = markdown;
  if (markdown.length > maxChars) {
    const half = Math.floor(maxChars / 2);
    contentSample = markdown.substring(0, half) + '\n\n[... content truncated ...]\n\n' + markdown.substring(markdown.length - half);
  }
  
  const authorHint = urlAuthor ? `\n\nNote: This content appears to be from "${urlAuthor}" based on the URL.` : '';
  
  return `You are analyzing educational content to extract high-quality metadata.

**Source URL:** ${sourceUrl}${authorHint}

**Content:**
${contentSample}

**Your task:**
Extract metadata that will help learners understand what this content teaches.

**Guidelines:**

1. **Title**: Use the actual title from the document if present. Keep it clear and specific.
   - Good: "Introduction to Python: Variables and Data Types"
   - Bad: "Chapter 1" or "Untitled Document"

2. **Description**: Write a learner-focused summary.
   - Focus on what they'll LEARN, not just what topics are covered
   - 1-2 sentences, ~100-200 characters
   - Good: "Learn Python basics through interactive examples. Master variables, operators, and comments while building simple programs."
   - Bad: "This document contains Python code examples."

3. **Author**: Extract from content if mentioned (bylines, author notes, signature).
   - Look for "by [Name]", "Author: [Name]", or similar
   - Return the name only, not titles or affiliations
   - If not found in content, return null (we may infer from URL)

4. **Topics**: List 3-5 main topics actually taught
   - Be specific: "List comprehensions" not just "Python"
   - Prioritize by coverage, not just mentions

5. **Level**: Assess difficulty based on:
   - Prerequisites assumed (beginner = none, intermediate = basics, advanced = specific knowledge)
   - Complexity of concepts
   - Depth of coverage

6. **Estimated Hours**: Rough time to learn this material
   - Consider: reading time, practice exercises, complexity
   - Typical: 0.5-2 hours for tutorials, 5-20 hours for courses

Return valid JSON matching the schema. Be accurate and helpful.`;
}
