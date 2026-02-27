/**
 * API endpoint to export user's completed work to GitHub
 * Creates a portfolio repo with their implementations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const username = (session.user as any).username as string;
    const accessToken = (session.user as any).accessToken as string;
    
    if (!username) {
      return NextResponse.json(
        { error: 'GitHub username not found in session' },
        { status: 401 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GitHub access token not found. Please log in again.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { libraryId, masteredConcepts, userCodeMap } = body;

    if (!libraryId || !masteredConcepts || !userCodeMap) {
      return NextResponse.json(
        { error: 'libraryId, masteredConcepts, and userCodeMap are required' },
        { status: 400 }
      );
    }

    // Use the user's GitHub OAuth access token
    const githubToken = accessToken;

    const octokit = new Octokit({ auth: githubToken });

    // Get library info
    const libraryResult = await pool.query(
      'SELECT id, name, slug, type FROM libraries WHERE slug = $1',
      [libraryId]
    );

    if (libraryResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Library not found' },
        { status: 404 }
      );
    }

    const library = libraryResult.rows[0];
    const libraryUuid = library.id;

    // Get program code
    const programResult = await pool.query(
      'SELECT program_code FROM library_programs WHERE library_id = $1',
      [libraryUuid]
    );

    const programCode = programResult.rows[0]?.program_code || '';

    // Get all concept functions for mastered concepts
    const functionsResult = await pool.query(
      'SELECT * FROM concept_functions WHERE library_id = $1 AND concept_id = ANY($2::text[])',
      [libraryUuid, masteredConcepts]
    );

    const functions = functionsResult.rows;

    // Generate files
    const lessonName = library.slug;
    const portfolioRepo = 'learning-portfolio';

    // Check if portfolio repo exists
    let repoExists = false;
    try {
      await octokit.repos.get({
        owner: username,
        repo: portfolioRepo,
      });
      repoExists = true;
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }

    // Create repo if it doesn't exist
    if (!repoExists) {
      await octokit.repos.createForAuthenticatedUser({
        name: portfolioRepo,
        description: 'My learning portfolio - code artifacts from interactive lessons',
        auto_init: true,
        private: false,
      });
      console.log(`✅ Created portfolio repo: ${username}/${portfolioRepo}`);
    }

    // Generate lesson files
    const lessonDir = `${lessonName}`;

    // 1. canonical.py - Full original program
    const canonicalPy = programCode;

    // 2. my_implementation.py - User's implementations
    const myImplementations: string[] = [];
    for (const func of functions) {
      const conceptId = func.concept_id;
      const userCode = userCodeMap[conceptId];
      if (userCode) {
        // Extract just the function implementation (remove test cases)
        const lines = userCode.split('\n');
        const funcStart = lines.findIndex((line: string) => line.trim().startsWith('def '));
        if (funcStart !== -1) {
          let funcEnd = funcStart + 1;
          // Find end of function (next def or test comment)
          for (let i = funcStart + 1; i < lines.length; i++) {
            if (lines[i].trim().startsWith('def ') || lines[i].trim().startsWith('# Test')) {
              break;
            }
            funcEnd = i;
          }
          const funcCode = lines.slice(funcStart, funcEnd + 1).join('\n');
          myImplementations.push(funcCode);
        }
      }
    }

    const myImplementationPy = `"""
My implementations for ${library.name}
"""

${myImplementations.join('\n\n')}
`;

    // 3. test_harness.py - Test runner
    const testCases: string[] = [];
    for (const func of functions) {
      if (func.test_cases && Array.isArray(func.test_cases)) {
        for (const tc of func.test_cases) {
          const testName = `test_${func.function_name}_${tc.name || testCases.length}`;
          const setup = tc.setup ? `    ${tc.setup}\n` : '';
          testCases.push(`
def ${testName}():
    """${tc.description || tc.name}"""
${setup}    ${tc.code}
`);
        }
      }
    }

    const testHarnessPy = `#!/usr/bin/env python3
"""
Test harness for ${library.name} implementations.
Runs tests against student implementations.
"""

# Import canonical program as base
from canonical import *

# Import student implementations (overrides canonical)
try:
    from my_implementation import *
except ImportError:
    print("⚠️  No implementations found, using canonical functions")

# Test cases
${testCases.join('\n')}

if __name__ == "__main__":
    import sys
    passed = 0
    failed = 0
    
    # Find all test functions
    test_functions = [
        (name, func) for name, func in globals().items() 
        if name.startswith("test_") and callable(func)
    ]
    
    for name, func in test_functions:
        try:
            func()
            print(f"✓ {name}")
            passed += 1
        except AssertionError as e:
            print(f"✗ {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {name}: {type(e).__name__}: {e}")
            failed += 1
    
    print(f"\\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
`;

    // 4. README.md - Lesson summary
    const functionTable = functions.map(func => {
      const hasImpl = userCodeMap[func.concept_id] ? '✓' : '○';
      const testCount = func.test_cases?.length || 0;
      return `| \`${func.function_name}\` | ${func.difficulty || 'N/A'} | ${hasImpl} ${testCount}/${testCount} |`;
    }).join('\n');

    const readmeMd = `# ${library.name}

**Completed:** ${new Date().toLocaleDateString()}  
**Concepts Mastered:** ${masteredConcepts.length}  

## What I Learned

${functions.map(f => `- ${f.function_name}: ${f.docstring || 'Implementation'}`).join('\n')}

## My Implementations

| Function | Difficulty | Tests |
|----------|-----------|-------|
${functionTable}

## Running the Code

\`\`\`bash
python test_harness.py
\`\`\`

## Files

- **canonical.py** - Complete working program from the lesson
- **my_implementation.py** - My implementations of key functions
- **test_harness.py** - Test suite to validate implementations
`;

    // Create/update files in repo
    const files = [
      { path: `${lessonDir}/canonical.py`, content: canonicalPy },
      { path: `${lessonDir}/my_implementation.py`, content: myImplementationPy },
      { path: `${lessonDir}/test_harness.py`, content: testHarnessPy },
      { path: `${lessonDir}/README.md`, content: readmeMd },
    ];

    for (const file of files) {
      // Check if file exists to get SHA for update
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({
          owner: username,
          repo: portfolioRepo,
          path: file.path,
        });
        if ('sha' in existing.data) {
          sha = existing.data.sha;
        }
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }
      }

      // Create or update file
      await octokit.repos.createOrUpdateFileContents({
        owner: username,
        repo: portfolioRepo,
        path: file.path,
        message: sha 
          ? `Update ${library.name} - ${masteredConcepts.length} concepts mastered`
          : `Add ${library.name} lesson`,
        content: Buffer.from(file.content).toString('base64'),
        sha,
      });
    }

    // Update root README
    const rootReadmePath = 'README.md';
    let rootReadme = `# My Learning Portfolio\n\nCode artifacts from interactive lessons.\n\n## Completed Lessons\n\n`;
    
    try {
      const existing = await octokit.repos.getContent({
        owner: username,
        repo: portfolioRepo,
        path: rootReadmePath,
      });
      if ('content' in existing.data) {
        rootReadme = Buffer.from(existing.data.content, 'base64').toString('utf-8');
      }
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }

    // Add or update lesson entry in root README
    const lessonEntry = `- **[${library.name}](${lessonDir}/)** - ${masteredConcepts.length} concepts mastered - ${new Date().toLocaleDateString()}`;
    if (!rootReadme.includes(library.name)) {
      rootReadme += `\n${lessonEntry}`;
      
      let rootReadmeSha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({
          owner: username,
          repo: portfolioRepo,
          path: rootReadmePath,
        });
        if ('sha' in existing.data) {
          rootReadmeSha = existing.data.sha;
        }
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }
      }

      await octokit.repos.createOrUpdateFileContents({
        owner: username,
        repo: portfolioRepo,
        path: rootReadmePath,
        message: `Add ${library.name} to portfolio`,
        content: Buffer.from(rootReadme).toString('base64'),
        sha: rootReadmeSha,
      });
    }

    const repoUrl = `https://github.com/${username}/${portfolioRepo}`;

    return NextResponse.json({
      success: true,
      repoUrl,
      lessonPath: `${repoUrl}/tree/main/${lessonDir}`,
      message: `Successfully exported ${masteredConcepts.length} concepts to ${portfolioRepo}`,
    });

  } catch (error) {
    console.error('Error exporting to GitHub:', error);
    return NextResponse.json(
      { error: 'Failed to export to GitHub', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
