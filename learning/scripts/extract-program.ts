#!/usr/bin/env tsx
/**
 * Extract complete, runnable program from a Jupyter notebook
 * 
 * Stage 5a: Program Extraction
 * 
 * Usage:
 *   npx tsx scripts/extract-program.ts <notebook-path>
 *   npx tsx scripts/extract-program.ts docs/TSP.ipynb
 * 
 * What it does:
 * 1. Read notebook JSON
 * 2. Use Gemini to extract complete program
 * 3. Verify program runs (smoke tests)
 * 4. Save to output file
 * 
 * Output:
 *   - <notebook-name>-program.py (complete runnable program)
 *   - <notebook-name>-program.json (metadata)
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface NotebookCell {
  cell_type: 'code' | 'markdown';
  source: string[];
  metadata?: any;
}

interface Notebook {
  cells: NotebookCell[];
  metadata?: any;
}

interface ExtractionResult {
  programCode: string;
  language: string;
  verified: boolean;
  metadata: {
    notebookPath: string;
    extractedAt: string;
    cellCount: number;
    codeBlockCount: number;
    extractionMethod: string;
  };
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GOOGLE_API_KEY or GEMINI_API_KEY not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

async function extractProgram(notebookPath: string): Promise<ExtractionResult> {
  console.log(`\n📖 Reading notebook: ${notebookPath}`);
  
  // Read notebook
  const notebookContent = fs.readFileSync(notebookPath, 'utf-8');
  const notebook: Notebook = JSON.parse(notebookContent);
  
  console.log(`   Cells: ${notebook.cells.length}`);
  
  // Extract all code cells
  const codeCells = notebook.cells
    .filter(cell => cell.cell_type === 'code')
    .map(cell => cell.source.join(''));
  
  console.log(`   Code blocks: ${codeCells.length}`);
  
  // Combine all code
  const allCode = codeCells.join('\n\n');
  
  console.log(`\n🤖 Using Gemini to extract complete program...`);
  
  // Prompt Gemini to extract a clean, runnable program
  const prompt = `You are extracting a complete, runnable Python program from a Jupyter notebook.

The notebook contains code cells with:
- Import statements
- Type aliases and constants
- Function definitions
- Example usage and test code

Your task:
1. Extract ALL executable code from the notebook
2. Organize it into a clean, runnable Python program:
   - All imports at the top
   - Type aliases and constants next
   - Helper functions
   - Main algorithms
   - Keep function definitions in dependency order (no forward references)
3. Remove:
   - Jupyter magic commands (!, %, %%)
   - Interactive calls like plot_tour(), run(), etc. (keep the function definitions)
   - Shell commands (curl, wget, etc.)
4. Preserve:
   - All function definitions with docstrings
   - All type aliases (City = complex, etc.)
   - All helper functions
5. Add a simple if __name__ == "__main__" block with basic smoke tests

Requirements:
- The program MUST be executable: python program.py should work
- Include ALL functions, even if they seem unused
- Preserve all docstrings and comments
- Use proper dependency order (define before use)

Here is the notebook code:

\`\`\`python
${allCode}
\`\`\`

Output ONLY the complete Python program, no explanations or markdown.`;

  const result = await model.generateContent(prompt);
  const programCode = result.response.text();
  
  // Clean up any markdown code fences if Gemini added them
  let cleanedCode = programCode
    .replace(/^```python\s*/m, '')
    .replace(/^```\s*$/m, '')
    .trim();
  
  console.log(`   Generated program: ${cleanedCode.split('\n').length} lines`);
  
  return {
    programCode: cleanedCode,
    language: 'python',
    verified: false, // Will verify in next step
    metadata: {
      notebookPath,
      extractedAt: new Date().toISOString(),
      cellCount: notebook.cells.length,
      codeBlockCount: codeCells.length,
      extractionMethod: 'gemini-2.0-flash-exp'
    }
  };
}

async function fixProgram(programCode: string, error: string, attempt: number): Promise<string> {
  console.log(`\n🔧 Asking Gemini to fix the error (attempt ${attempt})...`);
  
  const prompt = `This Python program has an error. Fix it.

Error:
${error}

Program:
\`\`\`python
${programCode}
\`\`\`

CRITICAL: Output ONLY the complete fixed Python program. No explanations, no markdown, just the code.`;

  console.log(`\n--- Sending to Gemini ---`);
  console.log(`Error summary: ${error.split('\n').slice(0, 3).join('\n')}`);
  console.log(`--- End Request ---\n`);

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  console.log(`\n--- Gemini Response (first 500 chars) ---`);
  console.log(response.substring(0, 500));
  console.log(`--- End Response ---\n`);
  
  const fixedCode = response
    .replace(/^```python\s*/m, '')
    .replace(/^```\s*$/m, '')
    .trim();
  
  return fixedCode;
}

async function verifyProgram(programCode: string, maxAttempts: number = 3): Promise<{ verified: boolean, code: string }> {
  console.log(`\n🧪 Verifying program...`);
  
  const { execSync } = require('child_process');
  let currentCode = programCode;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   Attempt ${attempt}/${maxAttempts}`);
    
    // Save to temp file
    const tempFile = '/tmp/extracted_program_test.py';
    fs.writeFileSync(tempFile, currentCode);
    
    try {
      const output = execSync(`python3 ${tempFile}`, {
        encoding: 'utf-8',
        timeout: 10000, // 10 second timeout
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      console.log(`   ✅ Program executed successfully`);
      if (output) {
        console.log(`   Output:\n${output}`);
      }
      
      // Clean up
      fs.unlinkSync(tempFile);
      
      return { verified: true, code: currentCode };
      
    } catch (error: any) {
      const errorMsg = error.stderr || error.message;
      console.error(`   ❌ Execution failed:`);
      console.error(`\n--- Full Error ---`);
      console.error(errorMsg);
      console.error(`--- End Error ---\n`);
      
      if (attempt < maxAttempts) {
        // Try to fix it
        currentCode = await fixProgram(currentCode, errorMsg, attempt);
        console.log(`   Fixed code (${currentCode.split('\n').length} lines)`);
      } else {
        console.error(`\n   Giving up after ${maxAttempts} attempts`);
        console.error(`   Final program saved to output file for manual inspection`);
      }
    }
  }
  
  // Clean up
  const tempFile = '/tmp/extracted_program_test.py';
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
  
  return { verified: false, code: currentCode };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/extract-program.ts <notebook-path>');
    console.error('Example: npx tsx scripts/extract-program.ts docs/TSP.ipynb');
    process.exit(1);
  }
  
  const notebookPath = args[0];
  
  if (!fs.existsSync(notebookPath)) {
    console.error(`❌ File not found: ${notebookPath}`);
    process.exit(1);
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Extract Complete Program (Stage 5a)');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Extract program
    const result = await extractProgram(notebookPath);
    
    // Verify it runs (with auto-fix loop)
    const { verified, code } = await verifyProgram(result.programCode);
    result.verified = verified;
    result.programCode = code; // Use fixed version if it was fixed
    
    // Save output
    const baseName = path.basename(notebookPath, '.ipynb');
    const outputDir = path.dirname(notebookPath);
    const programPath = path.join(outputDir, `${baseName}-program.py`);
    const metadataPath = path.join(outputDir, `${baseName}-program.json`);
    
    fs.writeFileSync(programPath, result.programCode);
    fs.writeFileSync(metadataPath, JSON.stringify(result.metadata, null, 2));
    
    console.log(`\n✅ Extraction complete!`);
    console.log(`   Program: ${programPath}`);
    console.log(`   Metadata: ${metadataPath}`);
    console.log(`   Verified: ${verified ? '✅ Yes' : '❌ No (needs fixes)'}`);
    
    if (!verified) {
      console.log(`\n⚠️  Program needs manual fixes before use`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Extraction failed:', error);
    process.exit(1);
  }
}

main();
