#!/usr/bin/env tsx
/**
 * Map functions to concepts and generate test cases
 * 
 * Stage 5b: Function Mapping
 * 
 * Usage:
 *   npx tsx scripts/map-functions-to-concepts.ts <library-slug>
 *   npx tsx scripts/map-functions-to-concepts.ts tsp
 * 
 * Fetches concept graph from database and picks ONE key function per concept
 * 
 * What it does:
 * 1. Parse program for function definitions
 * 2. Load concept graph from database/file
 * 3. Use Gemini to map each function to concepts
 * 4. Generate test cases (3-5 per function)
 * 5. Identify dependencies (which functions call which)
 * 6. Output JSON with function mappings
 * 
 * Output:
 *   - <program-name>-functions.json (function mappings with tests)
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ConceptGraph {
  concepts: Array<{
    id: string;
    name: string;
    description: string;
    learning_objectives?: string[];
  }>;
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
  concept_name: string;
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

function parseFunctions(programCode: string): Array<{
  name: string;
  signature: string;
  body: string;
  docstring: string | null;
  lineStart: number;
  lineEnd: number;
}> {
  console.log(`\n📝 Parsing functions from program...`);
  
  const lines = programCode.split('\n');
  const functions: Array<any> = [];
  
  // Simple regex-based parser (could use AST for more accuracy)
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    
    if (match) {
      const funcName = match[1];
      const params = match[2];
      const returnType = match[3] || '';
      const signature = `def ${funcName}(${params})${returnType ? ' -> ' + returnType : ''}:`;
      
      const lineStart = i + 1; // 1-indexed
      
      // Extract docstring
      let docstring: string | null = null;
      let j = i + 1;
      
      // Skip whitespace
      while (j < lines.length && lines[j].trim() === '') j++;
      
      // Check for docstring
      if (j < lines.length) {
        const docLine = lines[j].trim();
        if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
          const quote = docLine.startsWith('"""') ? '"""' : "'''";
          if (docLine.endsWith(quote) && docLine.length > 6) {
            // Single-line docstring
            docstring = docLine.slice(3, -3);
            j++;
          } else {
            // Multi-line docstring
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
      
      // Find end of function (next def or unindented line)
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
  
  console.log(`   Found ${functions.length} functions`);
  return functions;
}

async function mapFunctionToConcept(
  func: any,
  programCode: string,
  conceptGraph: ConceptGraph
): Promise<FunctionMapping> {
  console.log(`\n🤖 Mapping function: ${func.name}`);
  
  // Build concept list for prompt
  const conceptList = conceptGraph.concepts
    .map(c => `- ${c.id}: ${c.name} - ${c.description}`)
    .join('\n');
  
  const prompt = `You are mapping a Python function to a learning concept and generating test cases.

**Available Concepts:**
${conceptList}

**Function:**
\`\`\`python
${func.body}
\`\`\`

**Context (Complete Program):**
\`\`\`python
${programCode.substring(0, 3000)}
...
\`\`\`

**Your Task:**
1. Choose the MOST relevant concept this function teaches/demonstrates
2. List functions this function calls (dependencies)
3. Generate 3-5 test cases that verify correctness AND concept understanding
4. Estimate difficulty and time to implement

**Output Format (JSON):**
{
  "concept_id": "euclidean-distance",
  "concept_name": "Euclidean Distance",
  "dependencies": ["abs"],
  "difficulty": "basic",
  "estimated_time_minutes": 5,
  "test_cases": [
    {
      "name": "test_basic_correctness",
      "setup": "a = City(0, 0); b = City(3, 4)",
      "code": "assert distance(a, b) == 5.0",
      "points": 1,
      "description": "Correct distance for 3-4-5 triangle"
    }
  ]
}

Output ONLY valid JSON, no explanations.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Extract JSON from response
  let jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`   ❌ Failed to parse JSON response for ${func.name}`);
    console.error(`   Response: ${response.substring(0, 200)}`);
    throw new Error(`Failed to parse JSON for ${func.name}`);
  }
  
  const mapping = JSON.parse(jsonMatch[0]);
  
  console.log(`   Concept: ${mapping.concept_name}`);
  console.log(`   Tests: ${mapping.test_cases.length}`);
  console.log(`   Dependencies: ${mapping.dependencies.join(', ')}`);
  
  return {
    function_name: func.name,
    function_signature: func.signature,
    function_body: func.body,
    docstring: func.docstring,
    line_start: func.lineStart,
    line_end: func.lineEnd,
    concept_id: mapping.concept_id,
    concept_name: mapping.concept_name,
    dependencies: mapping.dependencies || [],
    test_cases: mapping.test_cases || [],
    difficulty: mapping.difficulty || 'intermediate',
    estimated_time_minutes: mapping.estimated_time_minutes || 10
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/map-functions-to-concepts.ts <program-file> <concept-graph-file>');
    console.error('Example: npx tsx scripts/map-functions-to-concepts.ts docs/TSP-program.py docs/tsp-concepts.json');
    process.exit(1);
  }
  
  const programPath = args[0];
  const conceptGraphPath = args[1];
  
  if (!fs.existsSync(programPath)) {
    console.error(`❌ Program file not found: ${programPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(conceptGraphPath)) {
    console.error(`❌ Concept graph file not found: ${conceptGraphPath}`);
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Map Functions to Concepts (Stage 5b)');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Load inputs
    const programCode = fs.readFileSync(programPath, 'utf-8');
    const conceptGraph: ConceptGraph = JSON.parse(fs.readFileSync(conceptGraphPath, 'utf-8'));
    
    console.log(`\n📖 Loaded:`);
    console.log(`   Program: ${programCode.split('\n').length} lines`);
    console.log(`   Concepts: ${conceptGraph.concepts.length}`);
    
    // Parse functions
    const functions = parseFunctions(programCode);
    
    // Map each function to a concept
    const mappings: FunctionMapping[] = [];
    
    for (const func of functions) {
      try {
        const mapping = await mapFunctionToConcept(func, programCode, conceptGraph);
        mappings.push(mapping);
      } catch (error: any) {
        console.error(`   ⚠️  Skipping ${func.name}: ${error.message}`);
      }
    }
    
    // Save output
    const baseName = path.basename(programPath, '.py');
    const outputPath = path.join(path.dirname(programPath), `${baseName}-functions.json`);
    
    const output = {
      program: programPath,
      concept_graph: conceptGraphPath,
      extracted_at: new Date().toISOString(),
      function_count: mappings.length,
      functions: mappings
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Function mapping complete!`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Functions mapped: ${mappings.length}/${functions.length}`);
    console.log(`   Total tests: ${mappings.reduce((sum, m) => sum + m.test_cases.length, 0)}`);
    
    // Summary by concept
    const conceptCounts = new Map<string, number>();
    mappings.forEach(m => {
      conceptCounts.set(m.concept_name, (conceptCounts.get(m.concept_name) || 0) + 1);
    });
    
    console.log(`\n📊 Functions by concept:`);
    for (const [concept, count] of conceptCounts.entries()) {
      console.log(`   ${concept}: ${count}`);
    }
    
  } catch (error) {
    console.error('\n❌ Mapping failed:', error);
    process.exit(1);
  }
}

main();
