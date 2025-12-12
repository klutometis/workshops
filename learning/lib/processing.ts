import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { chunkMarkdownFile, MarkdownChunk } from './markdown-chunker';

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
 * 2. Extract concepts (40%)
 * 3. Enrich concepts (60%)
 * 4. Generate embeddings (80%)
 * 5. Import to database (100%)
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
  
  // Generate slug and work directory
  const fileName = path.basename(filePath, '.md');
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const workDir = path.join(process.cwd(), 'markdown', slug);
  
  try {
    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    // Stage 1: Extract concepts from full markdown (20%)
    const conceptGraphPath = path.join(workDir, 'concept-graph.json');
    if (fs.existsSync(conceptGraphPath)) {
      onProgress?.('Extracting concepts', 20, 'Already extracted (skipping)');
    } else {
      onProgress?.('Extracting concepts', 20);
      try {
        runScript('scripts/markdown/extract-concepts.ts', [filePath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to extract concepts',
          'extract-concepts',
          error
        );
      }
    }
    
    // Stage 2: Chunk markdown into segments (40%)
    const chunksPath = path.join(workDir, 'chunks.json');
    if (fs.existsSync(chunksPath)) {
      onProgress?.('Chunking markdown', 40, 'Already chunked (skipping)');
    } else {
      onProgress?.('Chunking markdown', 40, `Processing ${fileName}`);
      try {
        runScript('scripts/markdown/chunk-markdown.ts', [filePath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to chunk markdown',
          'chunk-markdown',
          error
        );
      }
    }
    
    // Stage 3: Enrich concepts with pedagogy (60%)
    const enrichedConceptPath = path.join(workDir, 'concept-graph-enriched.json');
    if (fs.existsSync(enrichedConceptPath)) {
      onProgress?.('Enriching concepts', 60, 'Already enriched (skipping)');
    } else {
      onProgress?.('Enriching concepts', 60);
      try {
        runScript('scripts/markdown/enrich-concepts.ts', [filePath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to enrich concepts',
          'enrich-concepts',
          error
        );
      }
    }
    
    // Stage 4: Map chunks to concepts (70%)
    const mappingsPath = path.join(workDir, 'chunk-concept-mappings.json');
    if (fs.existsSync(mappingsPath)) {
      onProgress?.('Mapping chunks to concepts', 70, 'Already mapped (skipping)');
    } else {
      onProgress?.('Mapping chunks to concepts', 70);
      try {
        runScript('scripts/markdown/map-chunks-to-concepts.ts', [filePath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to map chunks to concepts',
          'map-chunks-to-concepts',
          error
        );
      }
    }
    
    // Stage 5: Generate embeddings (80%)
    const embeddingsPath = path.join(workDir, 'chunk-embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      onProgress?.('Generating embeddings', 80, 'Already embedded (skipping)');
    } else {
      onProgress?.('Generating embeddings', 80);
      try {
        runScript('scripts/markdown/embed-chunks.ts', [filePath]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to generate embeddings',
          'embed-chunks',
          error
        );
      }
    }
    
    // Stage 6: Import to database (100%)
    onProgress?.('Importing to database', 95);
    try {
      runScript('scripts/markdown/import-markdown-to-db.ts', [filePath]);
    } catch (error: any) {
      throw new ProcessingError(
        'Failed to import to database',
        'import-markdown-to-db',
        error
      );
    }
    
    onProgress?.('Complete', 100, 'Processing finished successfully');
    
    // Read results
    const enrichedPath = path.join(workDir, 'concept-graph-enriched.json');
    // embeddingsPath already declared in Stage 5 above
    
    const conceptGraph = JSON.parse(fs.readFileSync(enrichedPath, 'utf-8'));
    const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
    
    return {
      libraryId: slug,
      title: conceptGraph.metadata.title || fileName,
      slug,
      contentType: 'markdown',
      stats: {
        conceptCount: conceptGraph.nodes?.length || 0,
        segmentCount: embeddings.chunks?.length || 0,
        embeddingCount: embeddings.chunks?.length || 0,
      },
      metadata: {
        sourceFile: filePath,
        processedAt: new Date().toISOString(),
      },
    };
    
  } catch (error: any) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      `Markdown processing failed: ${error.message}`,
      'unknown',
      error
    );
  }
}

/**
 * Extract code blocks from markdown text
 */
function extractCodeBlocks(text: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = text.match(codeBlockRegex);
  return matches ? matches.join('\n\n') : '';
}

/**
 * Convert GitHub blob URL to raw URL
 */
function githubBlobToRaw(url: string): string {
  return url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const https = await import('https');
  const actualUrl = url.includes('github.com/') ? githubBlobToRaw(url) : url;
  
  return new Promise((resolve, reject) => {
    https.get(actualUrl, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location'));
          return;
        }
        downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Convert Jupyter notebook to markdown
 */
function convertNotebookToMarkdown(notebookPath: string): string {
  const notebook = JSON.parse(fs.readFileSync(notebookPath, 'utf-8'));
  const cells = notebook.cells || [];
  
  const markdownParts: string[] = [];
  
  // Add title from metadata if available
  if (notebook.metadata?.title) {
    markdownParts.push(`# ${notebook.metadata.title}\n`);
  }
  
  for (const cell of cells) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
    
    if (cell.cell_type === 'markdown') {
      markdownParts.push(source);
      markdownParts.push('\n');
    } else if (cell.cell_type === 'code') {
      // Add code cells as fenced code blocks
      markdownParts.push('```python');
      markdownParts.push(source);
      markdownParts.push('```\n');
      
      // Add outputs if present (converted to text)
      if (cell.outputs && cell.outputs.length > 0) {
        for (const output of cell.outputs) {
          if (output.output_type === 'stream' && output.text) {
            const text = Array.isArray(output.text) ? output.text.join('') : output.text;
            markdownParts.push('```');
            markdownParts.push(text);
            markdownParts.push('```\n');
          } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
            if (output.data && output.data['text/plain']) {
              const text = Array.isArray(output.data['text/plain']) 
                ? output.data['text/plain'].join('') 
                : output.data['text/plain'];
              markdownParts.push('```');
              markdownParts.push(text);
              markdownParts.push('```\n');
            }
          }
        }
      }
    }
  }
  
  return markdownParts.join('\n');
}

/**
 * Process a Jupyter notebook through the pipeline
 * 
 * Pipeline stages:
 * 1. Download notebook (if URL) (10%)
 * 2. Convert to markdown (20%)
 * 3. Process as markdown (20-100%)
 * 
 * @param urlOrPath - GitHub URL or local path to .ipynb file
 * @param onProgress - Optional progress callback
 * @returns Processing result with library ID and stats
 */
export async function processJupyterNotebook(
  urlOrPath: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  const isUrl = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://');
  
  let notebookPath: string;
  let fileName: string;
  
  try {
    // Stage 1: Download notebook if URL
    if (isUrl) {
      onProgress?.('Downloading notebook', 10, urlOrPath);
      
      // Extract filename from URL
      const urlParts = urlOrPath.split('/');
      fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
      if (!fileName.endsWith('.ipynb')) {
        throw new ProcessingError(
          'URL must point to a .ipynb file',
          'validation',
          new Error(`Invalid file: ${fileName}`)
        );
      }
      
      // Create temp directory
      const tempDir = path.join(process.cwd(), 'temp', 'notebooks');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      notebookPath = path.join(tempDir, fileName);
      
      try {
        await downloadFile(urlOrPath, notebookPath);
      } catch (error: any) {
        throw new ProcessingError(
          `Failed to download notebook: ${error.message}`,
          'download-notebook',
          error
        );
      }
    } else {
      // Local path
      notebookPath = path.resolve(urlOrPath);
      fileName = path.basename(notebookPath);
      
      if (!fs.existsSync(notebookPath)) {
        throw new ProcessingError(
          `Notebook file not found: ${notebookPath}`,
          'validation',
          new Error('File does not exist')
        );
      }
    }
    
    // Stage 2: Convert to markdown
    onProgress?.('Converting to markdown', 20, fileName);
    
    let markdownContent: string;
    try {
      markdownContent = convertNotebookToMarkdown(notebookPath);
    } catch (error: any) {
      throw new ProcessingError(
        `Failed to convert notebook to markdown: ${error.message}`,
        'convert-notebook',
        error
      );
    }
    
    // Save markdown to work directory
    const slug = path.basename(fileName, '.ipynb')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const workDir = path.join(process.cwd(), 'markdown', slug);
    
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    const markdownPath = path.join(workDir, `${slug}.md`);
    fs.writeFileSync(markdownPath, markdownContent, 'utf-8');
    
    onProgress?.('Markdown saved', 25, markdownPath);
    
    // Stage 3: Process as markdown (delegates to markdown pipeline)
    onProgress?.('Processing as markdown', 30);
    
    // Wrap the markdown progress callback to offset percentages
    const wrappedProgress: ProgressCallback = (stage, percent, message) => {
      // Map 0-100 from markdown processing to 30-100 in notebook processing
      const adjustedPercent = 30 + Math.floor(percent * 0.7);
      onProgress?.(stage, adjustedPercent, message);
    };
    
    const result = await processMarkdownFile(markdownPath, wrappedProgress);
    
    // Update result to reflect notebook source
    return {
      ...result,
      contentType: 'notebook',
      metadata: {
        ...result.metadata,
        sourceUrl: isUrl ? urlOrPath : undefined,
        sourceFile: notebookPath,
        convertedMarkdown: markdownPath,
      },
    };
    
  } catch (error: any) {
    if (error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(
      `Notebook processing failed: ${error.message}`,
      'unknown',
      error
    );
  }
}
