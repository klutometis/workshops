#!/usr/bin/env tsx
/**
 * Map functions to concepts - Smart approach
 * 
 * Usage: npx tsx scripts/map-functions-to-concepts-v2.ts <library-slug>
 * Example: npx tsx scripts/map-functions-to-concepts-v2.ts tsp
 * 
 * Strategy:
 * 1. Fetch enriched concept graph from database
 * 2. Parse extracted program for all functions
 * 3. For EACH concept, pick ONE key function to implement
 * 4. Generate tests based on concept's learning objectives
 * 5. Store in database
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pkg from 'pg';
const { Client } = pkg;

interface Concept {
  id: string;
  concept_id: string;
  name: string;
  description: string;
  learning_objectives: string[];
  mastery_indicators: any[];
}

interface TestCase {
  name: string;
  setup: string;
  code: string;
  points: number;
  description: string;
}

interface FunctionMapping {
  function_name: string;
  function_signature: string;
  function_body: string;
  docstring: string | null;
  line_start: number;
  line_end: number;
  concept_id: string;
  dependencies: string[];
  test_cases: TestCase[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  estimated_time_minutes: number;
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GOOGLE_API_KEY or GEMINI_API_KEY not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

// Database connection
const dbUrl = process.env.LEARNING_DATABASE_URL_PROXY || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Database connection not configured');
  process.exit(1);
}

async function fetchLibrary(slug: string) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  const result = await client.query(
    'SELECT id, title FROM libraries WHERE slug = $1 LIMIT 1',
    [slug]
  );
  
  await client.end();
  
  if (result.rows.length === 0) {
    throw new Error(`Library not found: ${slug}`);
  }
  
  return result.rows[0];
}

async function fetchConceptGraph(libraryId: string): Promise<Concept[]> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  const result = await client.query(
    `SELECT id, concept_id, name, description, difficulty, 
            learning_objectives, mastery_indicators
     FROM concepts 
     WHERE library_id = $1
     ORDER BY name`,
    [libraryId]
  );
  
  await client.end();
  
  return result.rows;
}

async function fetchProgram(libraryId: string): Promise<string | null> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  const result = await client.query(
    'SELECT program_code FROM library_programs WHERE library_id = $1',
    [libraryId]
  );
  
  await client.end();
  
  return result.rows.length > 0 ? result.rows[0].program_code : null;
}

function parseFunctions(programCode: string) {
  const lines = programCode.split('\n');
  const functions: any[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    
    if (match) {
      const funcName = match[1];
      const params = match[2];
      const returnType = match[3] || '';
      const signature = `def ${funcName}(${params})${returnType ? ' -> ' + returnType : ''}:`;
      
      const lineStart = i + 1;
      
      // Extract docstring
      let docstring: string | null = null;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      
      if (j < lines.length) {
        const docLine = lines[j].trim();
        if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
          const quote = docLine.startsWith('"""') ? '"""' : "'''";
          if (docLine.endsWith(quote) && docLine.length > 6) {
            docstring = docLine.slice(3, -3);
            j++;
          } else {
            let docLines = [docLine.slice(3)];
            j++;
            while (j < lines.length && !lines[j].includes(quote)) {
              docLines.push(lines[j]);
              j++;
            }
            if (j < lines.length) {
              docLines.push(lines[j].substring(0, lines[j].indexOf(quote)));
            }
            docstring = docLines.join('\n').trim();
            j++;
          }
        }
      }
      
      // Find end of function
      const baseIndent = line.match(/^\s*/)?.[0].length || 0;
      let k = i + 1;
      while (k < lines.length) {
        const nextLine = lines[k];
        if (nextLine.trim() === '') {
          k++;
          continue;
        }
        const indent = nextLine.match(/^\s*/)?.[0].length || 0;
        if (indent <= baseIndent && nextLine.trim().length > 0) {
          break;
        }
        k++;
      }
      
      const lineEnd = k;
      const body = lines.slice(i, k).join('\n');
      
      functions.push({
        name: funcName,
        signature,
        body,
        docstring,
        lineStart,
        lineEnd
      });
      
      i = k;
    } else {
      i++;
    }
  }
  
  return functions;
}

async function pickFunctionForConcept(
  concept: Concept,
  allFunctions: any[],
  programCode: string
): Promise<FunctionMapping | null> {
  console.log(`\n🎯 Concept: ${concept.name}`);
  
  // Ask Gemini to pick ONE best function for this concept
  const functionList = allFunctions.map(f => 
    `- ${f.name}${f.docstring ? ': ' + f.docstring : ''}`
  ).join('\n');
  
  const prompt = `You are picking THE BEST function for a student to implement to demonstrate mastery of a concept.

**Concept: ${concept.name}**
Description: ${concept.description}

Learning Objectives:
${concept.learning_objectives?.map((o: string) => `- ${o}`).join('\n') || '- (none)'}

**Available Functions:**
${functionList}

**Your Task:**
1. Determine if ANY function is appropriate for teaching this concept through implementation
2. DECLINE if the concept is too abstract, theoretical, or better taught through other means
3. If appropriate: Pick the ONE function that best teaches this concept
4. List its dependencies (functions it calls)
5. Generate 3-5 test cases based on the learning objectives
6. Estimate difficulty and time

**When to DECLINE:**
- Concept is a problem definition (not a solution technique)
- Concept is too abstract or meta-level
- Concept is better taught through reading/discussion
- No function directly implements this concept

**Output Format (JSON):**

If declining (no appropriate function):
{
  "chosen_function": null,
  "rationale": "This concept is about understanding the TSP problem definition, not implementing a specific algorithm"
}

If good match exists:
{
  "chosen_function": "distance",
  "rationale": "Core concept - directly implements Euclidean distance formula",
  "dependencies": ["abs"],
  "difficulty": "basic",
  "estimated_time_minutes": 5,
  "test_cases": [
    {
      "name": "test_3_4_5_triangle",
      "setup": "a = City(0, 0); b = City(3, 4)",
      "code": "assert distance(a, b) == 5.0",
      "points": 1,
      "description": "Correct distance for 3-4-5 right triangle"
    }
  ]
}

Output ONLY valid JSON, no explanations.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`   ❌ Failed to parse JSON`);
      return null;
    }
    
    const mapping = JSON.parse(jsonMatch[0]);
    
    // Check if Gemini declined to map this concept
    if (!mapping.chosen_function) {
      console.log(`   ⊘ Declined: ${mapping.rationale}`);
      return null;
    }
    
    const chosenFunc = allFunctions.find(f => f.name === mapping.chosen_function);
    
    if (!chosenFunc) {
      console.error(`   ❌ Function ${mapping.chosen_function} not found`);
      return null;
    }
    
    console.log(`   ✓ Chose: ${chosenFunc.name}`);
    console.log(`   ✓ Rationale: ${mapping.rationale}`);
    console.log(`   ✓ Tests: ${mapping.test_cases.length}`);
    
    return {
      function_name: chosenFunc.name,
      function_signature: chosenFunc.signature,
      function_body: chosenFunc.body,
      docstring: chosenFunc.docstring,
      line_start: chosenFunc.lineStart,
      line_end: chosenFunc.lineEnd,
      concept_id: concept.concept_id,
      dependencies: mapping.dependencies || [],
      test_cases: mapping.test_cases || [],
      difficulty: mapping.difficulty || concept.difficulty || 'intermediate',
      estimated_time_minutes: mapping.estimated_time_minutes || 10
    };
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function saveMappings(libraryId: string, mappings: FunctionMapping[]) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  for (const mapping of mappings) {
    await client.query(
      `INSERT INTO concept_functions 
       (library_id, concept_id, function_name, function_signature, function_body, 
        docstring, line_start, line_end, dependencies, test_cases, difficulty, estimated_time_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (library_id, function_name) 
       DO UPDATE SET
         concept_id = EXCLUDED.concept_id,
         function_signature = EXCLUDED.function_signature,
         function_body = EXCLUDED.function_body,
         docstring = EXCLUDED.docstring,
         line_start = EXCLUDED.line_start,
         line_end = EXCLUDED.line_end,
         dependencies = EXCLUDED.dependencies,
         test_cases = EXCLUDED.test_cases,
         difficulty = EXCLUDED.difficulty,
         estimated_time_minutes = EXCLUDED.estimated_time_minutes`,
      [
        libraryId,
        mapping.concept_id,
        mapping.function_name,
        mapping.function_signature,
        mapping.function_body,
        mapping.docstring,
        mapping.line_start,
        mapping.line_end,
        mapping.dependencies,
        JSON.stringify(mapping.test_cases),
        mapping.difficulty,
        mapping.estimated_time_minutes
      ]
    );
  }
  
  await client.end();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/map-functions-to-concepts-v2.ts <library-slug>');
    console.error('Example: npx tsx scripts/map-functions-to-concepts-v2.ts tsp');
    process.exit(1);
  }
  
  const slug = args[0];
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Map Functions to Concepts (Smart Strategy)');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Fetch library
    console.log(`\n📚 Fetching library: ${slug}`);
    const library = await fetchLibrary(slug);
    console.log(`   Found: ${library.title} (${library.id})`);
    
    // Fetch concept graph
    console.log(`\n🧠 Fetching concept graph...`);
    const concepts = await fetchConceptGraph(library.id);
    console.log(`   Concepts: ${concepts.length}`);
    
    // Fetch or load program
    console.log(`\n📖 Fetching program...`);
    let programCode = await fetchProgram(library.id);
    
    if (!programCode) {
      // Try loading from file
      const programPath = `docs/TSP-program.py`;
      if (fs.existsSync(programPath)) {
        programCode = fs.readFileSync(programPath, 'utf-8');
        console.log(`   Loaded from file: ${programPath}`);
      } else {
        throw new Error('No program found in database or filesystem');
      }
    } else {
      console.log(`   Loaded from database`);
    }
    
    console.log(`   Program: ${programCode.split('\n').length} lines`);
    
    // Parse functions
    console.log(`\n🔍 Parsing functions...`);
    const allFunctions = parseFunctions(programCode);
    console.log(`   Found: ${allFunctions.length} functions`);
    
    // Map each concept to ONE function and save immediately
    const mappings: FunctionMapping[] = [];
    
    // Connect to database once
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    try {
      for (const concept of concepts) {
        const mapping = await pickFunctionForConcept(concept, allFunctions, programCode);
        if (mapping) {
          // Save immediately to avoid connection timeout
          await client.query(
            `INSERT INTO concept_functions 
             (library_id, concept_id, function_name, function_signature, function_body, 
              docstring, line_start, line_end, dependencies, test_cases, difficulty, estimated_time_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (library_id, function_name) 
             DO UPDATE SET
               concept_id = EXCLUDED.concept_id,
               function_signature = EXCLUDED.function_signature,
               function_body = EXCLUDED.function_body,
               docstring = EXCLUDED.docstring,
               line_start = EXCLUDED.line_start,
               line_end = EXCLUDED.line_end,
               dependencies = EXCLUDED.dependencies,
               test_cases = EXCLUDED.test_cases,
               difficulty = EXCLUDED.difficulty,
               estimated_time_minutes = EXCLUDED.estimated_time_minutes`,
            [
              library.id,
              mapping.concept_id,
              mapping.function_name,
              mapping.function_signature,
              mapping.function_body,
              mapping.docstring,
              mapping.line_start,
              mapping.line_end,
              mapping.dependencies,
              JSON.stringify(mapping.test_cases),
              mapping.difficulty,
              mapping.estimated_time_minutes
            ]
          );
          console.log(`   💾 Saved to database`);
          mappings.push(mapping);
        }
      }
    } finally {
      await client.end();
    }
    
    console.log(`\n✅ Complete!`);
    console.log(`   Mapped: ${mappings.length}/${concepts.length} concepts`);
    console.log(`   Total tests: ${mappings.reduce((sum, m) => sum + m.test_cases.length, 0)}`);
    
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

main();
