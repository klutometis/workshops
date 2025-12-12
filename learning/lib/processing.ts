import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Progress callback for tracking processing stages
 * @param stage - Human-readable stage name
 * @param percent - Progress percentage (0-100)
 * @param message - Optional detailed message
 */
export type ProgressCallback = (
  stage: string,
  percent: number,
  message?: string
) => void;

/**
 * Result from processing any content type
 */
export interface ProcessingResult {
  libraryId: string;
  title: string;
  slug: string;
  contentType: 'youtube' | 'markdown' | 'notebook';
  stats: {
    conceptCount: number;
    segmentCount: number;
    embeddingCount: number;
    duration?: number; // For video content
  };
  metadata: {
    sourceUrl?: string;
    sourceFile?: string;
    processedAt: string;
  };
}

/**
 * Error thrown during processing
 */
export class ProcessingError extends Error {
  constructor(
    message: string,
    public stage: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

/**
 * Extract video ID from YouTube URL or return as-is if already an ID
 */
function extractVideoId(input: string): string {
  // If it's already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }
  
  // Extract from URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  throw new Error(`Invalid YouTube URL or video ID: ${input}`);
}

/**
 * Run a script (TypeScript or bash) and capture output
 */
function runScript(scriptPath: string, args: string[] = []): string {
  try {
    const fullPath = path.join(process.cwd(), scriptPath);
    
    // Determine how to run based on file extension
    let command: string;
    if (scriptPath.endsWith('.sh')) {
      command = `bash ${fullPath} ${args.join(' ')}`;
    } else if (scriptPath.endsWith('.ts')) {
      command = `npx tsx ${fullPath} ${args.join(' ')}`;
    } else {
      throw new Error(`Unsupported script type: ${scriptPath}`);
    }
    
    return execSync(command, { 
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large outputs
    });
  } catch (error: any) {
    throw new Error(`Script failed: ${scriptPath}\n${error.stderr || error.message}`);
  }
}

/**
 * Process a YouTube video through the complete pipeline
 * 
 * Pipeline stages:
 * 1. Download video with audio (10%)
 * 2. Transcribe audio (25%)
 * 3. Sample and analyze frames (45%)
 * 4. Extract concepts (60%)
 * 5. Enrich concepts with pedagogy (75%)
 * 6. Generate embeddings (85%)
 * 7. Import to database (100%)
 * 
 * @param urlOrId - YouTube URL or video ID
 * @param onProgress - Optional progress callback
 * @returns Processing result with library ID and stats
 */
export async function processYouTubeVideo(
  urlOrId: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  const videoId = extractVideoId(urlOrId);
  const videoDir = path.join(process.cwd(), 'youtube', videoId);
  
  try {
    // Stage 1: Download video (with audio using yt-dlp)
    const audioPath = path.join(videoDir, 'audio.mp3');
    const videoPath = path.join(videoDir, 'video.mp4');
    
    if (fs.existsSync(audioPath) && fs.existsSync(videoPath)) {
      onProgress?.('Downloading video', 10, 'Already downloaded (skipping)');
    } else {
      onProgress?.('Downloading video', 10, `Video ID: ${videoId}`);
      try {
        runScript('scripts/youtube/download-media.sh', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to download video',
          'download-video',
          error
        );
      }
    }
    
    // Stage 2: Transcribe audio using Google Cloud Speech-to-Text
    const transcriptPath = path.join(videoDir, 'audio-transcript.json');
    
    if (fs.existsSync(transcriptPath)) {
      onProgress?.('Transcribing audio', 25, 'Already transcribed (skipping)');
    } else {
      onProgress?.('Transcribing audio', 25);
      try {
        const audioPath = path.join(videoDir, 'audio.mp3');
        runScript('scripts/youtube/transcribe-audio.ts', [audioPath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to transcribe audio',
          'transcribe-audio',
          error
        );
      }
    }
    
    // Stage 3: Sample and analyze frames
    const analysisPath = path.join(videoDir, 'video-analysis.json');
    
    if (fs.existsSync(analysisPath)) {
      onProgress?.('Analyzing video frames', 40, 'Already analyzed (skipping)');
    } else {
      onProgress?.('Analyzing video frames', 40);
      try {
        runScript('scripts/youtube/analyze-frames.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to analyze frames',
          'analyze-frames',
          error
        );
      }
    }
    
    // Stage 4: Extract concepts
    const conceptGraphPath = path.join(videoDir, 'concept-graph.json');
    
    if (fs.existsSync(conceptGraphPath)) {
      onProgress?.('Extracting concepts', 55, 'Already extracted (skipping)');
    } else {
      onProgress?.('Extracting concepts', 55);
      try {
        runScript('scripts/youtube/extract-concepts.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to extract concepts',
          'extract-concepts',
          error
        );
      }
    }
    
    // Stage 5: Map code to concepts
    const codeMappingsPath = path.join(videoDir, 'code-concept-mappings.json');
    
    if (fs.existsSync(codeMappingsPath)) {
      onProgress?.('Mapping code to concepts', 60, 'Already mapped (skipping)');
    } else {
      onProgress?.('Mapping code to concepts', 60);
      try {
        runScript('scripts/youtube/map-code-to-concepts.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to map code to concepts',
          'map-code-to-concepts',
          error
        );
      }
    }
    
    // Stage 6: Enrich concepts with pedagogy
    const enrichedConceptPath = path.join(videoDir, 'concept-graph-enriched.json');
    
    if (fs.existsSync(enrichedConceptPath)) {
      onProgress?.('Enriching concepts', 68, 'Already enriched (skipping)');
    } else {
      onProgress?.('Enriching concepts', 68);
      try {
        runScript('scripts/youtube/enrich-concepts.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to enrich concepts',
          'enrich-concepts',
          error
        );
      }
    }
    
    // Stage 7: Map segments to concepts
    const segmentMappingsPath = path.join(videoDir, 'segment-concept-mappings.json');
    
    if (fs.existsSync(segmentMappingsPath)) {
      onProgress?.('Mapping segments to concepts', 75, 'Already mapped (skipping)');
    } else {
      onProgress?.('Mapping segments to concepts', 75);
      try {
        runScript('scripts/youtube/map-segments-to-concepts.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to map segments to concepts',
          'map-segments-to-concepts',
          error
        );
      }
    }
    
    // Stage 7: Generate embeddings
    const embeddingsPath = path.join(videoDir, 'segment-embeddings.json');
    
    if (fs.existsSync(embeddingsPath)) {
      onProgress?.('Generating embeddings', 85, 'Already embedded (skipping)');
    } else {
      onProgress?.('Generating embeddings', 85);
      try {
        runScript('scripts/youtube/embed-video-segments.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to generate embeddings',
          'embed-video-segments',
          error
        );
      }
    }
    
    // Stage 8: Import to database (always run - idempotent)
    onProgress?.('Importing to database', 95);
    try {
      runScript('scripts/import-youtube-to-db.ts', [videoId]);
    } catch (error: any) {
      throw new ProcessingError(
        'Failed to import to database',
        'import-youtube-to-db',
        error
      );
    }
    
    // Read results from concept-graph-enriched.json
    if (!fs.existsSync(enrichedConceptPath)) {
      throw new ProcessingError(
        'Concept graph not found after processing',
        'validation',
        new Error(`Missing: ${enrichedConceptPath}`)
      );
    }
    
    const conceptGraph = JSON.parse(fs.readFileSync(enrichedConceptPath, 'utf-8'));
    
    // Read embeddings to get actual count and segment count
    let embeddingCount = 0;
    let segmentCount = 0;
    if (fs.existsSync(embeddingsPath)) {
      const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
      embeddingCount = embeddings.segments?.length || 0;
      segmentCount = embeddings.segments?.length || 0;
    }
    
    onProgress?.('Complete', 100, 'Processing finished successfully');
    
    return {
      libraryId: videoId,
      title: conceptGraph.metadata.title,
      slug: videoId,
      contentType: 'youtube',
      stats: {
        conceptCount: conceptGraph.metadata.total_concepts || 0,
        segmentCount,
        embeddingCount,
        duration: conceptGraph.metadata.total_duration,
      },
      metadata: {
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        processedAt: new Date().toISOString(),
      },
    };
    
  } catch (error: any) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      `YouTube processing failed: ${error.message}`,
      'unknown',
      error
    );
  }
}

/**
 * Process a markdown file through the pipeline
 * 
 * Pipeline stages:
 * 1. Chunk markdown (20%)
 * 2. Extract concepts (50%)
 * 3. Generate embeddings (80%)
 * 4. Import to database (100%)
 * 
 * @param filePath - Path to markdown file
 * @param onProgress - Optional progress callback
 * @returns Processing result with library ID and stats
 */
export async function processMarkdownFile(
  filePath: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new ProcessingError(
      `Markdown file not found: ${filePath}`,
      'validation',
      new Error('File does not exist')
    );
  }
  
  // TODO: Implement markdown processing pipeline
  // For now, throw not implemented error
  throw new ProcessingError(
    'Markdown processing not yet implemented',
    'not-implemented',
    new Error('See Phase 1b Task 3')
  );
}

/**
 * Process a Jupyter notebook through the pipeline
 * 
 * Pipeline stages:
 * 1. Parse notebook (20%)
 * 2. Extract concepts from markdown + code cells (50%)
 * 3. Generate embeddings (80%)
 * 4. Import to database (100%)
 * 
 * @param filePath - Path to .ipynb file
 * @param onProgress - Optional progress callback
 * @returns Processing result with library ID and stats
 */
export async function processJupyterNotebook(
  filePath: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new ProcessingError(
      `Notebook file not found: ${filePath}`,
      'validation',
      new Error('File does not exist')
    );
  }
  
  // TODO: Implement notebook processing pipeline
  // For now, throw not implemented error
  throw new ProcessingError(
    'Jupyter notebook processing not yet implemented',
    'not-implemented',
    new Error('See Phase 1b Task 4')
  );
}
