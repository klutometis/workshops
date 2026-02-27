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
import {
  getPublicChaptersWithLibraries,
  getChaptersByUserId,
  getUserByUsername,
  createChapter,
} from '@/lib/db';

// ---------------------------------------------------------------------------
// GET /api/chapters
//   ?mine=true  → returns the authenticated user's books (requires auth)
//   (default)   → returns public books with their libraries (home page)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === 'true';

  try {
    if (mine) {
      // Authenticated: return the user's own books
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const username = (session.user as any).username;
      const user = await getUserByUsername(username);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const chapters = await getChaptersByUserId(user.id);
      const formatted = chapters.map((ch: any) => ({
        id: ch.id,
        title: ch.title,
        slug: ch.slug,
        description: ch.description,
        orderIndex: ch.order_index,
      }));

      return NextResponse.json({ chapters: formatted });
    }

    // Public: home page data
    const chapters = await getPublicChaptersWithLibraries();

    const formatted = chapters.map((chapter: any) => ({
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      description: chapter.description,
      orderIndex: chapter.order_index,
      libraries: chapter.libraries.map((lib: any) => ({
        id: lib.slug,
        title: lib.title,
        author: lib.author,
        type: lib.type,
        description: lib.description || lib.metadata?.description || `Learn ${lib.title}`,
        color: lib.metadata?.color || 'blue',
        chapterOrder: lib.chapter_order,
        stats: {
          totalConcepts: lib.total_concepts || 0,
          estimatedHours:
            lib.metadata?.estimated_hours || Math.ceil((lib.total_concepts || 10) * 0.5),
        },
        conceptGraphPath: `/api/concept-graph?library=${lib.slug}`,
        embeddingsPath: `/api/embeddings?library=${lib.slug}`,
      })),
    }));

    return NextResponse.json({ chapters: formatted });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/chapters — create a new book
// Body: { title: string, description?: string }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const username = (session.user as any).username;
    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (title.length > 200) {
      return NextResponse.json({ error: 'Title must be 200 characters or less' }, { status: 400 });
    }

    // Derive slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    const chapter = await createChapter({
      title: title.trim(),
      slug,
      description: description?.trim() || undefined,
      user_id: user.id,
      is_public: false, // default private; admin can toggle later
    });

    return NextResponse.json({
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      description: chapter.description,
      orderIndex: chapter.order_index,
    }, { status: 201 });
  } catch (error: any) {
    // Handle unique constraint violation (duplicate slug for user)
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A book with that title already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating chapter:', error);
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 });
  }
}
