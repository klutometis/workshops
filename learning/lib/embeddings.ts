
/**
 * A text segment that needs an embedding
 */
export interface TextSegment {
  /** Unique identifier for this segment */
  id: string;
  
  /** The text content to embed */
  text: string;
  
  /** Optional metadata to include in the result */
  metadata?: Record<string, any>;
}

/**
 * A text segment with its embedding vector
 */
export interface EmbeddedSegment extends TextSegment {
  /** The embedding vector (768 dimensions for text-embedding-004) */
  embedding: number[];
}

/**
 * Options for generating embeddings
 */
export interface EmbeddingOptions {
  /** The text segments to embed */
  segments: TextSegment[];
  
  /** Model to use for embeddings (default: gemini-embedding-001) */
  model?: string;
  
  /** Batch size for API requests (default: 100) */
  batchSize?: number;
  
  /** Task type hint for the model */
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION';
  
  /** Optional title/context for the embedding task */
  title?: string;
}

/**
 * Result from embedding generation
 */
export interface EmbeddingResult {
  /** Segments with their embeddings */
  segments: EmbeddedSegment[];
  
  /** Metadata about the embedding process */
  metadata: {
    total_embeddings: number;
    embedded_at: string;
    embedding_model: string;
    embedding_dimensions: number;
  };
}

/**
 * Generate embeddings for text segments using Gemini REST API
 * 
 * NOTE: We use REST API directly because the SDK is broken for batch embeddings.
 * We must specify outputDimensionality: 768 and normalize the vectors.
 * 
 * This is the core embedding generation logic, format-agnostic and reusable
 * for any text content (video segments, markdown chunks, notebook cells, etc.)
 * 
 * @param options - Configuration for embedding generation
 * @returns Promise<EmbeddingResult> - Segments with their embedding vectors
 * 
 * @example
 * ```typescript
 * const result = await generateEmbeddings({
 *   segments: [
 *     { id: 'seg-1', text: 'Introduction to neural networks' },
 *     { id: 'seg-2', text: 'Backpropagation algorithm explained' },
 *   ],
 *   model: 'gemini-embedding-001',
 *   batchSize: 10
 * });
 * 
 * console.log(result.segments[0].embedding); // [0.123, -0.456, ...] (768D normalized)
 * ```
 */
export async function generateEmbeddings(
  options: EmbeddingOptions
): Promise<EmbeddingResult> {
  const {
    segments,
    model = "gemini-embedding-001",
    batchSize = 10,
    taskType = "RETRIEVAL_DOCUMENT",
    title,
  } = options;
  
  // Validate inputs
  if (!segments || segments.length === 0) {
    throw new Error('At least one segment is required for embedding generation');
  }
  
  // Validate all segments have text
  for (const segment of segments) {
    if (!segment.text || segment.text.trim().length === 0) {
      throw new Error(`Segment ${segment.id} has no text content`);
    }
  }
  
  // Get API key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not found in environment');
  }
  
  const embeddedSegments: EmbeddedSegment[] = [];
  let embeddingDimensions = 0;
  
  // Process in batches
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(segments.length / batchSize);
    
    console.log(`   Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} segments...`);
    
    try {
      // Process each segment using REST API (SDK is broken)
      for (const segment of batch) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              content: { parts: [{ text: segment.text }] },
              outputDimensionality: 1536
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Embedding API failed: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.embedding || !data.embedding.values) {
          throw new Error(`No embedding returned for segment ${segment.id}`);
        }
        
        // Use raw embedding (default 1536D for gemini-embedding-001)
        const embedding = data.embedding.values;
        
        if (embeddingDimensions === 0) {
          embeddingDimensions = embedding.length;
        }
        
        embeddedSegments.push({
          ...segment,
          embedding: embedding,
        });
        
        // Rate limiting - be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`   ✓ Batch ${batchNumber}/${totalBatches} complete (${embeddedSegments.length}/${segments.length} total)`);
      
    } catch (error: any) {
      throw new Error(
        `Failed to generate embeddings for batch ${batchNumber}: ${error.message}`
      );
    }
  }
  
  return {
    segments: embeddedSegments,
    metadata: {
      total_embeddings: embeddedSegments.length,
      embedded_at: new Date().toISOString(),
      embedding_model: model,
      embedding_dimensions: embeddingDimensions,
    },
  };
}

/**
 * Generate a single query embedding (for semantic search)
 * 
 * @param query - The query text to embed
 * @param model - Model to use (default: gemini-embedding-001)
 * @returns Promise<number[]> - The embedding vector (768D, normalized)
 * 
 * @example
 * ```typescript
 * const queryVector = await generateQueryEmbedding(
 *   "What is backpropagation?",
 *   "gemini-embedding-001"
 * );
 * // Use queryVector for similarity search (768D normalized)
 * ```
 */
export async function generateQueryEmbedding(
  query: string,
  model: string = "gemini-embedding-001"
): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query text is required');
  }
  
  // Get API key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not found in environment');
  }
  
  // Use REST API directly (SDK is broken)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        content: { parts: [{ text: query }] },
        outputDimensionality: 1536
      })
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query embedding API failed: ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.embedding || !data.embedding.values) {
    throw new Error('No embedding returned for query');
  }
  
  // Use raw embedding (default 1536D for gemini-embedding-001)
  const embedding = data.embedding.values;
  
  return embedding;
}
