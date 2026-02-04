# Model Configuration

All LLM-powered features in this project use **gemini-3-flash-preview** for optimal performance.

## Current Model Usage

### Content Generation & Analysis
- **Concept extraction**: `gemini-3-flash-preview` (lib/concept-extractor.ts)
- **Concept enrichment**: `gemini-3-flash-preview` (scripts/markdown/enrich-concepts.ts, scripts/youtube/enrich-concepts.ts)
- **Semantic chunking**: `gemini-3-flash-preview` (lib/markdown-chunker.ts)
- **Chunk-to-concept mapping**: `gemini-3-flash-preview` (scripts/markdown/map-chunks-to-concepts.ts)
- **Video analysis**: `gemini-3-flash-preview` (scripts/youtube/analyze-frames.ts)
- **Code mapping**: `gemini-3-flash-preview` (scripts/youtube/map-code-to-concepts.ts)
- **Segment mapping**: `gemini-3-flash-preview` (scripts/youtube/map-segments-to-concepts.ts)

### Interactive Learning
- **Socratic dialogue**: `gemini-3-flash-preview` (app/api/socratic-dialogue/route.ts)

### Embeddings (Separate Model)
- **Text embeddings**: `gemini-embedding-001` (lib/embeddings.ts, scripts/*/embed-*.ts)
  - Note: Embedding model is separate and should remain `gemini-embedding-001`

## Why gemini-3-flash-preview?

- **Speed**: Fastest generation times in the Gemini family
- **Quality**: State-of-the-art reasoning and instruction following
- **Cost**: Best price-performance ratio
- **Features**: Full structured output support

## Updating Models

To change the model globally:

```bash
# Find all usage
grep -r "gemini-3-flash-preview" learning/

# Update to new model (example)
find learning/ -name "*.ts" -exec sed -i 's/gemini-3-flash-preview/gemini-4-flash/g' {} \;
```

## Model History

- **2025-01**: Migrated from `gemini-2.5-flash` and `gemini-2.0-flash-exp` to `gemini-3-flash-preview`
- **Initial**: Mixed usage of various gemini-2.x models

## Testing with Different Models

Set environment variable to override:

```bash
# Not implemented yet, but could add:
GEMINI_MODEL=gemini-4-flash npx tsx scripts/process-library.ts <id>
```
