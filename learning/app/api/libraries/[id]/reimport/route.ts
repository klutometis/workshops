import { NextRequest, NextResponse } from 'next/server';
import { getLibraryById } from '@/lib/db';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';

export async function POST(
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

    // Reset library status to pending and clear processed data
    await pool.query(
      `UPDATE libraries 
       SET status = 'pending', 
           processed_at = NULL,
           error_message = NULL,
           progress_message = 'Queued for reimport',
           processing_logs = '[]'::jsonb
       WHERE id = $1`,
      [id]
    );

    // Delete existing processed data (concepts, chunks, embeddings, etc.)
    // The CASCADE relationships should handle most of this
    await pool.query('DELETE FROM concepts WHERE library_id = $1', [id]);
    await pool.query('DELETE FROM text_chunks WHERE library_id = $1', [id]);
    await pool.query('DELETE FROM video_segments WHERE library_id = $1', [id]);
    await pool.query('DELETE FROM embeddings WHERE library_id = $1', [id]);
    await pool.query('DELETE FROM concept_functions WHERE library_id = $1', [id]);
    await pool.query('DELETE FROM library_programs WHERE library_id = $1', [id]);

    // Trigger background processing
    const processingMode = process.env.PROCESSING_MODE || 'local';
    
    try {
      if (processingMode === 'job') {
        // Production: Trigger Cloud Run Job
        console.log(`🚀 Triggering Cloud Run Job for library ${id}...`);
        
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
                  value: id
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
        console.log(`🚀 Spawning local background process for library ${id}...`);
        
        const { spawn } = await import('child_process');
        
        const child = spawn('npx', ['tsx', 'scripts/process-library.ts', id], {
          detached: true,
          stdio: 'ignore', // Don't capture output
          cwd: process.cwd(),
        });
        
        child.unref(); // Allow API to respond without waiting
        
        console.log(`✅ Local background processor spawned for library ${id}`);
      }
    } catch (error) {
      console.error('⚠️  Failed to start background processing:', error);
      // Don't fail the request - library is reset, user can retry processing manually
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Library queued for reimport. Processing will begin shortly.',
      library: await getLibraryById(id)
    });
  } catch (error) {
    console.error('Error reimporting library:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
