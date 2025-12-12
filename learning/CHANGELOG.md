# Changelog

All notable changes to the Little PAIPer learning platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### 2024-12-11 - Database-Backed Multimodal Content

**Major milestone:** Completed migration from on-disk JSON files to database-backed embeddings with full multimodal content support. This enables dynamic content uploads and rich teaching material for the Socratic dialogue system.

#### Added
- **Multimodal segment retrieval**: `search_segments()` database function now returns rich content:
  - `audio_start`, `audio_end` - precise timestamp boundaries
  - `visual_description` - what's shown in video frames
  - `code_content` - extracted code from the segment
  - `slide_content` - presentation slides if visible
  - `key_concepts` - identified concepts for each segment
- **Mastery indicators support**: 
  - Added `mastery_indicators` column to `concepts` table
  - Updated `get_concept_graph()` to include mastery indicators in API responses
  - Full pedagogical metadata now flows from enriched JSON → database → frontend

#### Changed
- **Import pipeline**: Updated `import-youtube-to-db.ts` to read from `concept-graph-enriched.json` (was `concept-graph.json`)
  - Now imports learning objectives, mastery indicators, and common misconceptions
  - Maintains idempotency for iterative development
- **Socratic dialogue API**: Fixed `/api/socratic-dialogue/route.ts` to:
  - Use correct field names (`segment_timestamp` instead of `timestamp`)
  - Assemble rich multimodal context from all available fields
  - Format timestamps as MM:SS or H:MM:SS (was showing NaN:NaN)
  - Build comprehensive teaching material combining transcript, visuals, code, and concepts

#### Fixed
- **Timestamp display**: Segments now show proper timestamps (e.g., "49:02") instead of "NaN:NaN"
- **Context truncation**: Socratic tutor now receives full 8,500+ character context (~2,126 tokens) instead of truncated fragments
- **Missing pedagogical data**: Learning objectives and mastery indicators now properly flow through the entire stack

#### Technical Details
- **Schema changes**: `schema.sql` updated with multimodal fields and mastery_indicators
- **Query optimization**: Vector similarity search now returns comprehensive segment data in a single query
- **Type safety**: All multimodal fields properly typed in TypeScript interfaces
- **Testing**: Verified with "PyTorch Tensors" concept from Karpathy GPT video

#### Impact
The Socratic dialogue system now has:
- ✅ Rich teaching material with code examples and visual context
- ✅ Structured learning objectives (5 per concept)
- ✅ Measurable mastery indicators (4 skill assessments per concept)
- ✅ Video provenance with accurate timestamps
- ✅ Semantic search across multimodal content

This completes **Phase 1** of the database migration, enabling the workshop use case where attendees can upload YouTube videos for processing.

---

## [0.1.0] - 2024-11-12

### Initial Release
- YouTube video processing pipeline
- Concept extraction with Gemini
- Static file-based learning modules (PAIP, TSP)
- Socratic dialogue with RAG
- Python scratchpad with Pyodide
- Concept graph visualization
