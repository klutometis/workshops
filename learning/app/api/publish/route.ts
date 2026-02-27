/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createLibrary, getUserByUsername, isSlugTaken } from '@/lib/db';
import pool from '@/lib/db';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { downloadFile, githubBlobToRaw, extractMarkdownTitle, convertNotebookToMarkdown } from '@/lib/processing';
import type { DocumentMetadata } from '@/lib/metadata-extractor';

// URL type detection
function detectSourceType(url: string): { type: 'youtube' | 'notebook' | 'markdown'; videoId?: string } | null {
  // YouTube detection
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return { type: 'youtube', videoId: youtubeMatch[1] };
  }

  // Jupyter notebook detection (.ipynb files from any source)
  if (url.endsWith('.ipynb')) {
    return { type: 'notebook' };
  }

  // Markdown detection (GitHub, gists, raw URLs)
  if (url.endsWith('.md')) {
    return { type: 'markdown' };
  }

  return null;
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Extract video ID from YouTube URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Fetch real YouTube video metadata (title, author, etc.)
function fetchYouTubeMetadata(videoId: string): { title: string; author: string } | null {
  try {
    // Run fetch-video-info script synchronously
    execSync(`npx tsx scripts/youtube/fetch-video-info.ts ${videoId}`, {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 10000, // 10 second timeout
    });
    
    // Read the generated video-info.json
    const videoInfoPath = path.join(process.cwd(), 'youtube', videoId, 'video-info.json');
    if (fs.existsSync(videoInfoPath)) {
      const videoInfo = JSON.parse(fs.readFileSync(videoInfoPath, 'utf-8'));
      return {
        title: videoInfo.title || 'YouTube Video',
        author: videoInfo.author || videoInfo.channel || 'Unknown'
      };
    }
    
    return null;
  } catch (error) {
    console.error('⚠️  Failed to fetch YouTube metadata:', error);
    return null;
  }
}

// Extract title from URL (temporary, will be replaced during processing)
function extractTitleFromUrl(url: string, type: string): string {
  if (type === 'youtube') {
    return 'YouTube Video'; // Will be replaced with actual title
  }
  
  // Extract filename from URL
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.(md|ipynb)$/, '').replace(/[-_]/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Get user from database
    const username = (session.user as any).username;
    if (!username) {
      return NextResponse.json(
        { error: 'Username not found in session' },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { url, title: customTitle, isPublic = false } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // 4. Detect source type
    const detected = detectSourceType(url);
    if (!detected) {
      return NextResponse.json(
        { error: 'Unsupported URL format. Supported: YouTube, GitHub notebooks (.ipynb), Markdown (.md)' },
        { status: 400 }
      );
    }

    // 5. Extract metadata — LLM for markdown/notebook, YouTube API for videos
    // This is the key improvement: we get a good title BEFORE creating the
    // library row, so the slug is derived from the real title ("introduction-
    // to-lisp") instead of the filename ("chapter1").
    let title: string;
    let author: string = user.github_name || user.github_login;
    let extractedMetadata: DocumentMetadata | null = null;
    let tempLibraryId: string | null = null;  // Pre-generated for work dir
    
    if (detected.type === 'youtube' && detected.videoId) {
      // YouTube: use existing metadata flow (fast, no LLM needed)
      console.log(`📹 Fetching YouTube metadata for: ${detected.videoId}`);
      const metadata = fetchYouTubeMetadata(detected.videoId);
      if (metadata) {
        title = customTitle || metadata.title;
        author = metadata.author;
        console.log(`✅ Got title: ${title}`);
      } else {
        console.log('⚠️  Using fallback title');
        title = customTitle || extractTitleFromUrl(url, detected.type);
      }
    } else if (!customTitle) {
      // Markdown/Notebook: download + extract metadata via LLM
      // This takes ~5-10s but gives us a real title for the slug
      console.log(`📋 Extracting metadata from ${detected.type} content...`);
      
      // Pre-generate a library ID so we can save metadata to the right work dir
      tempLibraryId = crypto.randomUUID();
      const workDir = path.join('/tmp', 'markdown', tempLibraryId);
      fs.mkdirSync(workDir, { recursive: true });
      
      try {
        let markdownContent: string;
        
        // Convert GitHub blob URLs to raw URLs
        let downloadUrl = url;
        if (url.includes('github.com') && url.includes('/blob/')) {
          downloadUrl = githubBlobToRaw(url);
        }
        
        if (detected.type === 'notebook') {
          // Download .ipynb, convert to markdown, read content
          const urlParts = url.split('/');
          const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
          const notebookDir = path.join('/tmp', 'notebooks', tempLibraryId);
          fs.mkdirSync(notebookDir, { recursive: true });
          const notebookPath = path.join(notebookDir, fileName);
          
          await downloadFile(downloadUrl, notebookPath);
          const converted = convertNotebookToMarkdown(notebookPath);
          markdownContent = converted.cleaned;
        } else {
          // Markdown: download and read
          const urlParts = url.split('/');
          const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
          const filePath = path.join(workDir, fileName);
          
          await downloadFile(downloadUrl, filePath);
          markdownContent = fs.readFileSync(filePath, 'utf-8');
        }
        
        // Call LLM metadata extraction
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (apiKey) {
          const { extractMetadata } = await import('@/lib/metadata-extractor');
          extractedMetadata = await extractMetadata(markdownContent, url, apiKey);
          
          console.log(`📋 Extracted: "${extractedMetadata.title}" by ${extractedMetadata.author || 'unknown'}`);
          
          // Save to work dir so the pipeline skips re-extraction
          const metadataPath = path.join(workDir, 'extracted-metadata.json');
          fs.writeFileSync(metadataPath, JSON.stringify(extractedMetadata, null, 2));
          
          title = extractedMetadata.title;
          if (extractedMetadata.author) {
            author = extractedMetadata.author;
          }
        } else {
          console.warn('⚠️  No API key — falling back to markdown title extraction');
          // Fallback: try to extract # header from content
          const headerMatch = markdownContent.match(/^#\s+(.+)$/m);
          title = headerMatch ? headerMatch[1].trim() : extractTitleFromUrl(url, detected.type);
        }
      } catch (error) {
        console.warn('⚠️  Metadata extraction failed, using fallback:', error);
        title = extractTitleFromUrl(url, detected.type);
      }
    } else {
      // Custom title provided by user
      title = customTitle;
    }
    
    // 6. Check if library already exists (for re-import)
    // URLs are the true unique key - same URL = same content = re-import
    let library;
    let isReimport = false;
    let slug = generateSlug(title);
    
    const existingResult = await pool.query(
      'SELECT * FROM libraries WHERE source_url = $1 AND user_id = $2',
      [url, user.id]
    );
    
    if (existingResult.rows.length > 0) {
      // Case 1: URL exists → Re-import (keep existing slug)
      library = existingResult.rows[0];
      isReimport = true;
      slug = library.slug;
      console.log(`🔄 Re-importing existing library: ${library.id} (slug: ${slug})`);
    } else {
      // New URL - check if slug is available
      const slugTaken = await isSlugTaken(slug, user.id);
      
      if (slugTaken) {
        // Case 3: Slug collision → Add deterministic hash of URL (like git commits)
        const urlHash = crypto.createHash('sha256')
          .update(url)
          .digest('hex')
          .substring(0, 8); // First 8 chars
        
        slug = `${slug}-${urlHash}`;
        console.log(`⚠️  Slug collision detected, using hash suffix: ${slug}`);
      }
      // else: Case 2: Slug available → Use as-is
    }
    
    // If re-importing, reset the existing library to pending
    if (isReimport && library) {
      // Build metadata update — preserve existing fields, add reimport timestamp
      const metadataUpdate = extractedMetadata
        ? {
            reimported_at: new Date().toISOString(),
            description: extractedMetadata.description,
            topics: extractedMetadata.topics,
            level: extractedMetadata.level,
            estimated_hours: extractedMetadata.estimated_hours,
          }
        : { reimported_at: new Date().toISOString() };
      
      await pool.query(
        `UPDATE libraries 
         SET title = $1, 
             author = $2,
             is_public = $3,
             status = 'pending',
             progress_message = NULL,
             error_message = NULL,
             processing_logs = '[]'::jsonb,
             metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
         WHERE id = $5`,
        [title, author, isPublic, JSON.stringify(metadataUpdate), library.id]
      );
      
      // Move pre-computed work dir for re-import too
      if (tempLibraryId) {
        const tempDir = path.join('/tmp', 'markdown', tempLibraryId);
        const realDir = path.join('/tmp', 'markdown', library.id);
        if (fs.existsSync(tempDir)) {
          // Remove old work dir if it exists, replace with fresh metadata
          if (fs.existsSync(realDir)) {
            fs.rmSync(realDir, { recursive: true });
          }
          fs.renameSync(tempDir, realDir);
          console.log(`📁 Moved work dir: ${tempLibraryId} → ${library.id}`);
        }
        const tempNotebookDir = path.join('/tmp', 'notebooks', tempLibraryId);
        const realNotebookDir = path.join('/tmp', 'notebooks', library.id);
        if (fs.existsSync(tempNotebookDir)) {
          if (fs.existsSync(realNotebookDir)) {
            fs.rmSync(realNotebookDir, { recursive: true });
          }
          fs.renameSync(tempNotebookDir, realNotebookDir);
        }
      }
    }
    
    // Create new library if not re-importing
    if (!library) {
      library = await createLibrary({
        title,
        author,
        type: detected.type,
        slug,
        source_url: url,
        video_id: detected.videoId,
        user_id: user.id,
        is_public: isPublic,
        source_type: detected.type,
        metadata: {
          imported_by: user.github_login,
          imported_at: new Date().toISOString(),
          ...(extractedMetadata ? {
            description: extractedMetadata.description,
            topics: extractedMetadata.topics,
            level: extractedMetadata.level,
            estimated_hours: extractedMetadata.estimated_hours,
          } : {}),
        }
      });
    }
    
    // Move pre-computed work dir to match the actual library ID.
    // The pipeline uses /tmp/markdown/<libraryId>/ — if we pre-generated a
    // temp ID for metadata extraction, rename it so the pipeline finds the
    // cached extracted-metadata.json and downloaded files.
    if (tempLibraryId && tempLibraryId !== library.id) {
      const tempDir = path.join('/tmp', 'markdown', tempLibraryId);
      const realDir = path.join('/tmp', 'markdown', library.id);
      if (fs.existsSync(tempDir)) {
        fs.renameSync(tempDir, realDir);
        console.log(`📁 Moved work dir: ${tempLibraryId} → ${library.id}`);
      }
      // Also move notebook temp dir if it exists
      const tempNotebookDir = path.join('/tmp', 'notebooks', tempLibraryId);
      const realNotebookDir = path.join('/tmp', 'notebooks', library.id);
      if (fs.existsSync(tempNotebookDir)) {
        fs.renameSync(tempNotebookDir, realNotebookDir);
      }
    }

    console.log(`📚 Library created: ID=${library.id}, slug=${slug}, type=${detected.type}`);
    console.log(`🔗 URL: /users/${username}/${slug}`);

    // 7. Trigger background processing
    const processingMode = process.env.PROCESSING_MODE || 'local';
    
    try {
      if (processingMode === 'job') {
        // Production: Trigger Cloud Run Job
        console.log(`🚀 Triggering Cloud Run Job for library ${library.id}...`);
        
        const projectId = process.env.CLOUD_RUN_PROJECT_ID;
        const region = process.env.CLOUD_RUN_REGION;
        const jobName = process.env.CLOUD_RUN_JOB_NAME || 'learning-processor';
        
        if (!projectId || !region) {
          throw new Error('CLOUD_RUN_PROJECT_ID and CLOUD_RUN_REGION must be set when PROCESSING_MODE=job');
        }
        
        // Get access token for Google Cloud API
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();
        
        // Trigger Cloud Run Job via REST API
        const url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/jobs/${jobName}:run`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            overrides: {
              containerOverrides: [{
                env: [{
                  name: 'LIBRARY_ID',
                  value: library.id
                }]
              }]
            }
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Cloud Run Job failed: ${response.status} ${error}`);
        }
        
        const result = await response.json();
        console.log(`✅ Cloud Run Job triggered successfully: ${result.name}`);
        
      } else {
        // Local development: Spawn background process
        console.log(`🚀 Spawning local background process for library ${library.id}...`);
        
        const { spawn } = await import('child_process');
        
        const child = spawn('npx', ['tsx', 'scripts/process-library.ts', library.id], {
          detached: true,
          stdio: 'ignore', // Don't capture output
          cwd: process.cwd(),
        });
        
        child.unref(); // Allow API to respond without waiting
        
        console.log(`✅ Local background processor spawned for library ${library.id}`);
      }
    } catch (error) {
      console.error('⚠️  Failed to start background processing:', error);
      // Don't fail the request - library is created, user can retry processing
    }

    // 8. Return success with redirect URL
    return NextResponse.json({
      success: true,
      libraryId: library.id,
      slug: library.slug,
      url: `/users/${username}/${slug}`,
      message: isReimport 
        ? 'Library updated successfully. Re-processing will begin shortly.'
        : 'Library created successfully. Processing will begin shortly.',
      isReimport,
    }, { status: isReimport ? 200 : 201 });

  } catch (error) {
    console.error('Error publishing library:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
