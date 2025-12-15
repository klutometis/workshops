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
import { getLibraryBySlug, getConceptGraph } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const librarySlug = searchParams.get('library');

    if (!librarySlug) {
      return NextResponse.json(
        { error: 'Missing library parameter' },
        { status: 400 }
      );
    }

    // Look up library by slug
    const library = await getLibraryBySlug(librarySlug);
    
    if (!library) {
      return NextResponse.json(
        { error: `Library not found: ${librarySlug}` },
        { status: 404 }
      );
    }

    // Fetch concept graph using the library's UUID
    const conceptGraph = await getConceptGraph(library.id);

    if (!conceptGraph) {
      return NextResponse.json(
        { error: 'No concept graph found for this library' },
        { status: 404 }
      );
    }

    // Add source type and notebook data for frontend rendering
    return NextResponse.json({
      ...conceptGraph,
      source_type: library.source_type || 'markdown',
      notebook_data: library.notebook_data || null,
    });
  } catch (error) {
    console.error('Error fetching concept graph:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
