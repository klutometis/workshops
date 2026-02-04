import { NextRequest, NextResponse } from 'next/server';
import { getLibraryById, updateLibrary } from '@/lib/db';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid library ID format' },
        { status: 400 }
      );
    }

    const library = await getLibraryById(id);

    if (!library) {
      return NextResponse.json(
        { error: 'Library not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(library);
  } catch (error) {
    console.error('Error fetching library:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid library ID format' },
        { status: 400 }
      );
    }

    // Check authentication
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get existing library to verify ownership
    const library = await getLibraryById(id);
    if (!library) {
      return NextResponse.json(
        { error: 'Library not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, is_public } = body;

    // Validation
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json(
          { error: 'Title is required and must be a non-empty string' },
          { status: 400 }
        );
      }
      if (title.length > 200) {
        return NextResponse.json(
          { error: 'Title must be 200 characters or less' },
          { status: 400 }
        );
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return NextResponse.json(
          { error: 'Description must be a string' },
          { status: 400 }
        );
      }
      if (description.length > 1000) {
        return NextResponse.json(
          { error: 'Description must be 1000 characters or less' },
          { status: 400 }
        );
      }
    }

    // Note: is_public validation would go here (admin-only check)
    // For now, we'll allow any authenticated user to update their own libraries
    // TODO: Add admin role check for is_public changes

    // Update library
    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim() || null;
    if (is_public !== undefined && typeof is_public === 'boolean') {
      // TODO: Add admin check here
      updates.is_public = is_public;
    }

    const updated = await updateLibrary(id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update library' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating library:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid library ID format' },
        { status: 400 }
      );
    }

    // Check authentication
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get existing library to verify ownership
    const library = await getLibraryById(id);
    if (!library) {
      return NextResponse.json(
        { error: 'Library not found' },
        { status: 404 }
      );
    }

    // TODO: Verify ownership - check library.user_id matches session.user.id
    // For now, only authenticated users can delete

    // Delete library (CASCADE will remove related data)
    await pool.query('DELETE FROM libraries WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Library deleted successfully' });
  } catch (error) {
    console.error('Error deleting library:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
