import { z } from "zod";

/**
 * Pedagogical enrichment schema for concepts.
 * 
 * This schema defines the learning metadata that Gemini generates
 * for any concept, regardless of content source (YouTube, markdown, etc.)
 * 
 * Used by:
 * - scripts/youtube/enrich-concepts.ts
 * - scripts/markdown/enrich-concepts.ts
 */
export const pedagogicalEnrichmentSchema = z.object({
  learning_objectives: z.array(z.string())
    .describe("3-5 specific, measurable learning goals starting with action verbs"),
  
  mastery_indicators: z.array(z.object({
    skill: z.string().describe("Short identifier for this skill (e.g., 'base_case_identification')"),
    description: z.string().describe("What mastery of this skill demonstrates"),
    difficulty: z.enum(["basic", "intermediate", "advanced"]),
    test_method: z.string().describe("Concrete way to assess this skill in Socratic dialogue"),
  })).describe("CRITICAL: These determine when students can progress to next concepts"),
  
  misconceptions: z.array(z.object({
    misconception: z.string().describe("Common incorrect belief about this concept"),
    reality: z.string().describe("What is actually true"),
    correction_strategy: z.string().describe("How to guide student from misconception to reality"),
  })),
  
  key_insights: z.array(z.string())
    .describe("2-4 fundamental truths or 'aha moments' about this concept"),
  
  // Optional: Let Gemini add more if useful
  practical_applications: z.array(z.string()).optional()
    .describe("Real-world uses or applications of this concept"),
  
  common_gotchas: z.array(z.string()).optional()
    .describe("Practical pitfalls or tricky aspects when implementing"),
  
  debugging_tips: z.array(z.string()).optional()
    .describe("How to debug issues related to this concept"),
});

export type PedagogicalEnrichment = z.infer<typeof pedagogicalEnrichmentSchema>;
