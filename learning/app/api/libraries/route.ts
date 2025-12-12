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

import { NextResponse } from 'next/server';
import { getAllLibraries } from '@/lib/db';

export async function GET() {
  try {
    const libraries = await getAllLibraries();
    
    // Transform database format to frontend format
    const formatted = libraries.map(lib => ({
      id: lib.slug, // Use slug as the ID for frontend
      title: lib.title,
      author: lib.author,
      type: lib.type,
      description: lib.metadata?.description || `Learn ${lib.title}`,
      color: lib.metadata?.color || 'blue',
      stats: {
        totalConcepts: lib.total_concepts || 0,
        estimatedHours: lib.metadata?.estimated_hours || Math.ceil((lib.total_concepts || 10) * 0.5)
      },
      // Keep these for backwards compatibility, even though we're using DB now
      conceptGraphPath: `/api/concept-graph?library=${lib.slug}`,
      embeddingsPath: `/api/embeddings?library=${lib.slug}`
    }));

    return NextResponse.json({ libraries: formatted });
  } catch (error) {
    console.error('Error fetching libraries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch libraries' },
      { status: 500 }
    );
  }
}
