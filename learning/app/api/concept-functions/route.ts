/**
 * API endpoint to fetch function data for a concept
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const libraryId = searchParams.get('libraryId');
  const conceptId = searchParams.get('conceptId');

  if (!libraryId || !conceptId) {
    return NextResponse.json(
      { error: 'libraryId and conceptId are required' },
      { status: 400 }
    );
  }

  try {
    // First, get the library UUID from the slug
    const libraryResult = await pool.query(
      'SELECT id FROM libraries WHERE slug = $1',
      [libraryId]
    );

    if (libraryResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Library not found' },
        { status: 404 }
      );
    }

    const libraryUuid = libraryResult.rows[0].id;

    // Fetch the function for this library and concept
    const functionResult = await pool.query(
      'SELECT * FROM concept_functions WHERE library_id = $1 AND concept_id = $2 LIMIT 1',
      [libraryUuid, conceptId]
    );

    if (functionResult.rows.length === 0) {
      return NextResponse.json({ function: null });
    }

    // Fetch the library program code to prepend as context
    const programResult = await pool.query(
      'SELECT program_code FROM library_programs WHERE library_id = $1',
      [libraryUuid]
    );

    const programCode = programResult.rows.length > 0 ? programResult.rows[0].program_code : null;

    return NextResponse.json({ 
      function: functionResult.rows[0],
      programCode: programCode
    });
  } catch (error) {
    console.error('Error fetching concept function:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concept function' },
      { status: 500 }
    );
  }
}
