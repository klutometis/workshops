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

// URL type detection
function detectSourceType(url: string): { type: 'youtube' | 'notebook' | 'markdown'; videoId?: string } | null {
  // YouTube detection
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return { type: 'youtube', videoId: youtubeMatch[1] };
  }

  // GitHub notebook detection
  if (url.includes('github.com') && url.endsWith('.ipynb')) {
    return { type: 'notebook' };
  }

  // Markdown detection (GitHub, gists, raw URLs)
  if (url.endsWith('.md') || url.includes('raw.githubusercontent.com')) {
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
    const { url, title: customTitle, isPublic = true } = body;

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

    // 5. Generate title and slug
    // For YouTube videos, fetch real metadata first to get semantic title
    let title: string;
    let author: string = user.github_name || user.github_login;
    
    if (detected.type === 'youtube' && detected.videoId) {
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
    } else {
      title = customTitle || extractTitleFromUrl(url, detected.type);
    }
    
    let slug = generateSlug(title);
    
    // Ensure slug uniqueness for this user
    let counter = 1;
    while (await isSlugTaken(slug, user.id)) {
      slug = `${generateSlug(title)}-${counter}`;
      counter++;
    }

    // 6. Check if library already exists (for re-import)
    let library;
    let isReimport = false;
    
    if (detected.videoId) {
      // Check if this video is already imported by this user
      const existingResult = await pool.query(
        'SELECT * FROM libraries WHERE video_id = $1 AND user_id = $2',
        [detected.videoId, user.id]
      );
      
      if (existingResult.rows.length > 0) {
        // Re-import: Update existing library
        library = existingResult.rows[0];
        isReimport = true;
        
        await pool.query(
          `UPDATE libraries 
           SET title = $1, 
               slug = $2, 
               source_url = $3,
               is_public = $4,
               status = 'pending',
               progress_message = NULL,
               error_message = NULL,
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb),
                 '{reimported_at}',
                 to_jsonb(NOW())
               )
           WHERE id = $5`,
          [title, slug, url, isPublic, library.id]
        );
        
        // Update in-memory object to match database
        library.slug = slug;
        library.title = title;
        
        console.log(`🔄 Re-importing existing library: ${library.id} with new slug: ${slug}`);
      }
    }
    
    // Create new library if not re-importing
    if (!library) {
      library = await createLibrary({
        title,
        author, // Use fetched author for YouTube, or user's name for other types
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
        }
      });
    }

    console.log(`📚 Library created: ID=${library.id}, slug=${slug}, type=${detected.type}`);
    console.log(`🔗 URL: /users/${username}/${slug}`);

    // 7. Trigger background processing
    try {
      const { spawn } = await import('child_process');
      
      // Spawn processor as detached background process
      const child = spawn('npx', ['tsx', 'scripts/process-library.ts', library.id], {
        detached: true,
        stdio: 'ignore', // Don't capture output
        cwd: process.cwd(),
      });
      
      child.unref(); // Allow API to respond without waiting
      
      console.log(`🚀 Background processing started for library ${library.id}`);
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
