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
    const title = customTitle || extractTitleFromUrl(url, detected.type);
    let slug = generateSlug(title);
    
    // Ensure slug uniqueness for this user
    let counter = 1;
    while (await isSlugTaken(slug, user.id)) {
      slug = `${generateSlug(title)}-${counter}`;
      counter++;
    }

    // 6. Create library record
    const library = await createLibrary({
      title,
      author: user.github_name || user.github_login,
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

    // 7. TODO: Trigger processing pipeline asynchronously
    // For now, just return the library
    // Next step: Call processing scripts based on type

    return NextResponse.json({
      success: true,
      library: {
        id: library.id,
        slug: library.slug,
        title: library.title,
        type: library.type,
        status: library.status,
        url: `/users/${username}/${slug}`
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error publishing library:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
