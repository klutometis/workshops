import { execFileSync } from 'child_process';
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
) => Promise<void> | void;

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
  // Extracted metadata from LLM analysis (optional - only on first import)
  extractedMetadata?: {
    description?: string;
    author?: string;
    topics?: string[];
    level?: 'beginner' | 'intermediate' | 'advanced';
    estimated_hours?: number;
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

    // Use execFileSync (no shell) so special characters in args (apostrophes,
    // spaces, $, backticks, etc.) are passed through safely without quoting.
    let cmd: string;
    let cmdArgs: string[];
    if (scriptPath.endsWith('.sh')) {
      cmd = 'bash';
      cmdArgs = [fullPath, ...args];
    } else if (scriptPath.endsWith('.ts')) {
      cmd = 'npx';
      cmdArgs = ['tsx', fullPath, ...args];
    } else {
      throw new Error(`Unsupported script type: ${scriptPath}`);
    }

    return execFileSync(cmd, cmdArgs, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'inherit'],  // Inherit stderr so errors are visible
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large outputs
    });
  } catch (error: any) {
    // Capture both stdout and stderr for debugging
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    const combined = [
      `Script: ${scriptPath}`,
      `Exit code: ${error.status || 'unknown'}`,
      stderr ? `\nSTDERR:\n${stderr}` : '',
      stdout ? `\nSTDOUT:\n${stdout}` : '',
    ].filter(Boolean).join('\n');
    
    throw new Error(combined || error.message);
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
  const videoDir = path.join('/tmp', 'youtube', videoId);
  
  try {
    // Stage 1: Download video (with audio using yt-dlp)
    const audioPath = path.join(videoDir, 'audio.mp3');
    const videoPath = path.join(videoDir, 'video.mp4');
    
    if (fs.existsSync(audioPath) && fs.existsSync(videoPath)) {
      await onProgress?.('Downloading video', 10, 'Already downloaded (skipping)');
    } else {
      await onProgress?.('Downloading video', 10, `Video ID: ${videoId}`);
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
    
    // Stage 2: Fetch video metadata (title, author, etc.)
    const videoInfoPath = path.join(videoDir, 'video-info.json');
    
    if (fs.existsSync(videoInfoPath)) {
      await onProgress?.('Fetching video info', 20, 'Already fetched (skipping)');
    } else {
      await onProgress?.('Fetching video info', 20, 'Getting real title and author from YouTube');
      try {
        runScript('scripts/youtube/fetch-video-info.ts', [videoId]);
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to fetch video info',
          'fetch-video-info',
          error
        );
      }
    }
    
    // Stage 3: Transcribe audio using Google Cloud Speech-to-Text
    const transcriptPath = path.join(videoDir, 'audio-transcript.json');
    
    if (fs.existsSync(transcriptPath)) {
      await onProgress?.('Transcribing audio', 25, 'Already transcribed (skipping)');
    } else {
      await onProgress?.('Transcribing audio', 25);
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
    
    // Stage 4: Sample and analyze frames
    const analysisPath = path.join(videoDir, 'video-analysis.json');
    
    if (fs.existsSync(analysisPath)) {
      await onProgress?.('Analyzing video frames', 40, 'Already analyzed (skipping)');
    } else {
      await onProgress?.('Analyzing video frames', 40);
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
    
    // Stage 5: Extract concepts
    const conceptGraphPath = path.join(videoDir, 'concept-graph.json');
    
    if (fs.existsSync(conceptGraphPath)) {
      await onProgress?.('Extracting concepts', 55, 'Already extracted (skipping)');
    } else {
      await onProgress?.('Extracting concepts', 55);
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
    
    // Stage 6: Map code to concepts
    const codeMappingsPath = path.join(videoDir, 'code-concept-mappings.json');
    
    if (fs.existsSync(codeMappingsPath)) {
      await onProgress?.('Mapping code to concepts', 60, 'Already mapped (skipping)');
    } else {
      await onProgress?.('Mapping code to concepts', 60);
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
    
    // Stage 7: Enrich concepts with pedagogy
    const enrichedConceptPath = path.join(videoDir, 'concept-graph-enriched.json');
    
    if (fs.existsSync(enrichedConceptPath)) {
      await onProgress?.('Enriching concepts', 68, 'Already enriched (skipping)');
    } else {
      await onProgress?.('Enriching concepts', 68);
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
    
    // Stage 8: Map segments to concepts
    const segmentMappingsPath = path.join(videoDir, 'segment-concept-mappings.json');
    
    if (fs.existsSync(segmentMappingsPath)) {
      await onProgress?.('Mapping segments to concepts', 75, 'Already mapped (skipping)');
    } else {
      await onProgress?.('Mapping segments to concepts', 75);
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
    
    // Stage 9: Generate embeddings
    const embeddingsPath = path.join(videoDir, 'segment-embeddings.json');
    
    if (fs.existsSync(embeddingsPath)) {
      await onProgress?.('Generating embeddings', 85, 'Already embedded (skipping)');
    } else {
      await onProgress?.('Generating embeddings', 85);
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
    
    // Stage 10: Import to database (always run - idempotent)
    await onProgress?.('Importing to database', 95);
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
    
    await onProgress?.('Complete', 100, 'Processing finished successfully');
    
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
 * @param libraryId - Database library ID (UUID)
 * @param onProgress - Optional progress callback
 * @returns Processing result with library ID and stats
 */
export async function processMarkdownFile(
  urlOrPath: string,
  libraryId: string,
  onProgress?: ProgressCallback,
  options?: {
    /** Content type for DB import: 'markdown' (default) or 'notebook' */
    contentType?: 'markdown' | 'notebook';
    /** Path to original .ipynb file — stored as notebook_data in DB (notebook only) */
    notebookPath?: string;
    /** Override which markdown file gets stored in DB (e.g. raw version with images) */
    markdownPathForDb?: string;
    /** Skip LLM metadata extraction (e.g. reimport to preserve manual edits) */
    skipMetadata?: boolean;
    /** Original source URL (when caller already downloaded; urlOrPath is a local path) */
    sourceUrl?: string;
  }
): Promise<ProcessingResult> {
  const isUrl = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://');

  let filePath: string;

  // Stage 0: Download if URL
  if (isUrl) {
    const urlParts = urlOrPath.split('/');
    const remoteFileName = decodeURIComponent(urlParts[urlParts.length - 1]);
    const tempDir = path.join('/tmp', 'markdown', libraryId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    filePath = path.join(tempDir, remoteFileName);

    if (!fs.existsSync(filePath)) {
      await onProgress?.('Downloading content', 5, urlOrPath);
      try {
        await downloadFile(urlOrPath, filePath);
      } catch (error: any) {
        throw new ProcessingError(
          `Failed to download markdown: ${error.message}`,
          'download-markdown',
          error
        );
      }
    } else {
      await onProgress?.('Downloading content', 5, 'Already downloaded (skipping)');
    }
  } else {
    filePath = urlOrPath;
  }

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new ProcessingError(
      `Markdown file not found: ${filePath}`,
      'validation',
      new Error('File does not exist')
    );
  }
  
  // Generate slug and work directory (use libraryId for isolation)
  const fileName = path.basename(filePath, '.md');
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const workDir = path.join('/tmp', 'markdown', libraryId);
  
  try {
    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    // Stage 1: Extract metadata via LLM (10%)
    // Idempotent — if extracted-metadata.json already exists (e.g. pre-computed
    // at publish time), skip the LLM call.
    // Can be skipped entirely via options.skipMetadata (e.g. reimport to preserve manual edits).
    const metadataPath = path.join(workDir, 'extracted-metadata.json');
    if (options?.skipMetadata) {
      console.log(`📋 Skipping metadata extraction (preserving existing metadata)`);
    } else if (fs.existsSync(metadataPath)) {
      await onProgress?.('Extracting metadata', 10, 'Already extracted (skipping)');
    } else {
      await onProgress?.('Extracting metadata', 10);
      try {
        const { extractMetadata: extractMetadataFn } = await import('./metadata-extractor');
        const markdownContent = fs.readFileSync(filePath, 'utf-8');
        const metadata = await extractMetadataFn(
          markdownContent,
          isUrl ? urlOrPath : filePath,
          process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || ''
        );
        
        console.log(`📋 Extracted metadata:`);
        console.log(`   Title: ${metadata.title}`);
        console.log(`   Description: ${metadata.description}`);
        console.log(`   Author: ${metadata.author || 'Not identified'}`);
        console.log(`   Topics: ${metadata.topics.join(', ')}`);
        console.log(`   Level: ${metadata.level}`);
        console.log(`   Estimated: ${metadata.estimated_hours || 'N/A'} hours`);
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        console.warn(`⚠️  Failed to extract metadata (continuing anyway):`, error);
        // Non-fatal — processing can continue without metadata
      }
    }
    
    // Stage 2: Extract concepts from full markdown (25%)
    const conceptGraphPath = path.join(workDir, 'concept-graph.json');
    if (fs.existsSync(conceptGraphPath)) {
      await onProgress?.('Extracting concepts', 25, 'Already extracted (skipping)');
    } else {
      await onProgress?.('Extracting concepts', 25);
      try {
        runScript('scripts/markdown/extract-concepts.ts', [filePath]);
        if (!fs.existsSync(conceptGraphPath)) {
          throw new Error(
            `Concept extraction completed but output not found: ${conceptGraphPath}\n` +
            `Work dir: ${workDir}\n` +
            `Markdown: ${filePath}`
          );
        }
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to extract concepts',
          'extract-concepts',
          error
        );
      }
    }
    
    // Stage 3: Chunk markdown into segments (40%)
    const chunksPath = path.join(workDir, 'chunks.json');
    if (fs.existsSync(chunksPath)) {
      await onProgress?.('Chunking markdown', 40, 'Already chunked (skipping)');
    } else {
      await onProgress?.('Chunking markdown', 40);
      try {
        runScript('scripts/markdown/chunk-markdown.ts', [filePath]);
        if (!fs.existsSync(chunksPath)) {
          throw new Error(`Chunking completed but output not found: ${chunksPath}`);
        }
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to chunk markdown',
          'chunk-markdown',
          error
        );
      }
    }
    
    // Stage 4: Enrich concepts with pedagogy (60%)
    const enrichedConceptPath = path.join(workDir, 'concept-graph-enriched.json');
    if (fs.existsSync(enrichedConceptPath)) {
      await onProgress?.('Enriching concepts', 60, 'Already enriched (skipping)');
    } else {
      await onProgress?.('Enriching concepts', 60);
      try {
        runScript('scripts/markdown/enrich-concepts.ts', [filePath]);
        if (!fs.existsSync(enrichedConceptPath)) {
          const debugInfo = [
            `Enrichment completed but output not found: ${enrichedConceptPath}`,
            `Work dir: ${workDir}`,
            `Markdown: ${filePath}`,
          ];
          if (fs.existsSync(workDir)) {
            const files = fs.readdirSync(workDir);
            debugInfo.push(`Files in work dir: ${files.join(', ')}`);
          }
          throw new Error(debugInfo.join('\n'));
        }
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to enrich concepts',
          'enrich-concepts',
          error
        );
      }
    }
    
    // Stage 5: Map chunks to concepts (70%)
    const mappingsPath = path.join(workDir, 'chunk-concept-mappings.json');
    if (fs.existsSync(mappingsPath)) {
      await onProgress?.('Mapping chunks to concepts', 70, 'Already mapped (skipping)');
    } else {
      await onProgress?.('Mapping chunks to concepts', 70);
      try {
        runScript('scripts/markdown/map-chunks-to-concepts.ts', [filePath]);
        if (!fs.existsSync(mappingsPath)) {
          throw new Error(`Mapping completed but output not found: ${mappingsPath}`);
        }
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to map chunks to concepts',
          'map-chunks-to-concepts',
          error
        );
      }
    }
    
    // Stage 6: Generate embeddings (85%)
    const embeddingsPath = path.join(workDir, 'chunk-embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      await onProgress?.('Generating embeddings', 85, 'Already embedded (skipping)');
    } else {
      await onProgress?.('Generating embeddings', 85);
      try {
        runScript('scripts/markdown/embed-chunks.ts', [filePath]);
        if (!fs.existsSync(embeddingsPath)) {
          throw new Error(`Embedding completed but output not found: ${embeddingsPath}`);
        }
      } catch (error: any) {
        throw new ProcessingError(
          'Failed to generate embeddings',
          'embed-chunks',
          error
        );
      }
    }
    
    // Stage 7: Import to database (95%)
    // Builds import args based on content type. For notebooks, passes the
    // original .ipynb path and the raw markdown (with images) for DB storage.
    await onProgress?.('Importing to database', 95);
    try {
      const importType = options?.contentType || 'markdown';
      const markdownForDb = options?.markdownPathForDb || filePath;
      const importArgs = [
        '--library-id', libraryId,
        '--type', importType,
        '--markdown-path', markdownForDb,
      ];
      if (importType === 'notebook' && options?.notebookPath) {
        importArgs.push('--notebook-path', options.notebookPath);
      }
      runScript('scripts/import-to-db.ts', importArgs);
    } catch (error: any) {
      throw new ProcessingError(
        'Failed to import to database',
        'import-to-db',
        error
      );
    }
    
    await onProgress?.('Complete', 100, 'Processing finished successfully');
    
    // Read results
    const conceptGraph = JSON.parse(fs.readFileSync(enrichedConceptPath, 'utf-8'));
    const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
    
    // Read extracted metadata if available
    let extractedMeta: any = undefined;
    if (fs.existsSync(metadataPath)) {
      try {
        extractedMeta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      } catch (error) {
        console.warn(`⚠️  Could not read extracted metadata:`, error);
      }
    }
    
    const markdownTitle = extractMarkdownTitle(filePath);
    const title = extractedMeta?.title || conceptGraph.metadata?.title || markdownTitle || fileName;
    
    const sourceUrl = options?.sourceUrl || (isUrl ? urlOrPath : undefined);
    
    return {
      libraryId,
      title,
      slug,
      contentType: options?.contentType || 'markdown',
      stats: {
        conceptCount: conceptGraph.nodes?.length || 0,
        segmentCount: embeddings.chunks?.length || 0,
        embeddingCount: embeddings.chunks?.length || 0,
      },
      metadata: {
        sourceUrl,
        sourceFile: filePath,
        processedAt: new Date().toISOString(),
      },
      extractedMetadata: extractedMeta ? {
        description: extractedMeta.description,
        author: extractedMeta.author,
        topics: extractedMeta.topics,
        level: extractedMeta.level,
        estimated_hours: extractedMeta.estimated_hours,
      } : undefined,
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
 * Convert GitHub blob URL to raw URL
 */
export function githubBlobToRaw(url: string): string {
  return url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');
}

/**
 * Download file from URL
 */
export async function downloadFile(url: string, outputPath: string): Promise<void> {
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
 * Extract title from markdown file (first # header)
 */
export function extractMarkdownTitle(markdownPath: string): string | null {
  try {
    const content = fs.readFileSync(markdownPath, 'utf-8');
    
    // Match first # header (not ##, ###, etc.)
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Clean markdown for LLM processing
 * Removes images and HTML tags while preserving structure (headers, code blocks, etc.)
 */
export function cleanMarkdownForLLM(markdown: string): string {
  // Remove markdown image syntax: ![alt](url)
  markdown = markdown.replace(/!\[.*?\]\(.*?\)/g, '');
  
  // Remove HTML img tags: <img src="..." />
  markdown = markdown.replace(/<img[^>]*>/gi, '');
  
  // Strip HTML tags but keep their text content
  // (e.g., <strong>text</strong> → text)
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Clean up multiple consecutive newlines (left by removed images/HTML)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  return markdown;
}

/**
 * Convert Jupyter notebook to markdown using nbconvert
 * Returns both raw (with images) and cleaned (for LLM) versions
 */
export function convertNotebookToMarkdown(notebookPath: string): { raw: string; cleaned: string } {
  try {
    // Use uvx with jupyter-core for robust conversion (no global install needed)
    const rawMarkdown = execFileSync(
      'uvx',
      ['--from', 'nbconvert', 'jupyter', 'nbconvert', '--to', 'markdown', '--stdout', '--no-prompt', notebookPath],
      {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large notebooks
      }
    );
    
    // Return both versions:
    // - raw: for display (with inline images)
    // - cleaned: for LLM processing (images stripped)
    return {
      raw: rawMarkdown,
      cleaned: cleanMarkdownForLLM(rawMarkdown)
    };
    
  } catch (error: any) {
    throw new Error(
      `Failed to convert notebook with nbconvert: ${error.message}\n` +
      `Make sure uv is installed: https://docs.astral.sh/uv/getting-started/installation/`
    );
  }
}

/**
 * Process a Jupyter notebook through the complete pipeline
 * 
 * Downloads the notebook (if URL), converts to markdown, then delegates
 * the entire pipeline to processMarkdownFile() — including DB import.
 * 
 * @param urlOrPath - GitHub URL or local path to .ipynb file
 * @param libraryId - Database library ID (UUID)
 * @param onProgress - Optional progress callback
 * @param doExtractMetadata - Set false on reimport to preserve manual edits
 * @returns Processing result with library ID and stats
 */
export async function processJupyterNotebook(
  urlOrPath: string,
  libraryId: string,
  onProgress?: ProgressCallback,
  doExtractMetadata: boolean = true
): Promise<ProcessingResult> {
  const isUrl = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://');
  
  let notebookPath: string;
  let fileName: string;
  
  try {
    // Stage 1: Download notebook if URL (5%)
    if (isUrl) {
      await onProgress?.('Downloading notebook', 5, urlOrPath);
      
      const urlParts = urlOrPath.split('/');
      fileName = decodeURIComponent(urlParts[urlParts.length - 1]);
      if (!fileName.endsWith('.ipynb')) {
        throw new ProcessingError(
          'URL must point to a .ipynb file',
          'validation',
          new Error(`Invalid file: ${fileName}`)
        );
      }
      
      const tempDir = path.join('/tmp', 'notebooks', libraryId);
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
    
    // Stage 2: Convert to markdown (15%)
    await onProgress?.('Converting to markdown', 15, fileName);
    
    const converted = convertNotebookToMarkdown(notebookPath);
    
    // Save both raw (with images, for DB) and cleaned (for LLM pipeline)
    const slug = path.basename(fileName, '.ipynb')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const workDir = path.join('/tmp', 'markdown', libraryId);
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }
    
    const rawMarkdownPath = path.join(workDir, `${slug}-raw.md`);
    const cleanedMarkdownPath = path.join(workDir, `${slug}.md`);
    fs.writeFileSync(rawMarkdownPath, converted.raw, 'utf-8');
    fs.writeFileSync(cleanedMarkdownPath, converted.cleaned, 'utf-8');
    
    // Stage 3: Delegate everything to processMarkdownFile()
    // It handles: metadata → concepts → chunk → enrich → map → embed → DB import
    const wrappedProgress: ProgressCallback = async (stage, percent, message) => {
      // Map markdown's 0-100% into notebook's 20-100% range
      const adjusted = 20 + Math.floor(percent * 0.8);
      await onProgress?.(stage, adjusted, message);
    };
    
    return await processMarkdownFile(
      cleanedMarkdownPath,
      libraryId,
      wrappedProgress,
      {
        contentType: 'notebook',
        notebookPath,
        markdownPathForDb: rawMarkdownPath,
        skipMetadata: !doExtractMetadata,
        sourceUrl: isUrl ? urlOrPath : undefined,
      }
    );
    
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
