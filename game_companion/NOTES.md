# Game Companion Development Notes

## Current Session - EU4 Embeddings & Voice Chat Generalization

### Issues Identified & Solutions

#### 1. EU4 Embeddings Build Process
**Problem**: The wget2 command in `bin/build/eu4_embeddings.sh` was downloading images, CSS, JS, and other non-HTML files, cluttering the build process.

**Solution**: Updated wget2 command with:
- `--no-page-requisites` - Prevents downloading CSS/JS/images referenced by HTML pages
- `--reject="*.png,*.jpg,*.jpeg,*.gif,*.svg,*.webp,*.ico,*.css,*.js,*.pdf,*.zip,*.woff,*.woff2,*.ttf,*.eot,*.mp3,*.mp4,*.avi,*.mov"` - Explicitly blocks common file types
- Simplified regex to focus on wiki-specific URL patterns

**Result**: Clean build process with 2.4M of EU4 wiki content processed into 2001 chunks.

#### 2. Embeddings Search Quality
**Problem**: EU4 embeddings search returning irrelevant results for tutorial queries like "what do I do first?" The beginner's guide content exists but gets diluted among other wiki content.

**Analysis**: 
- The beginner's guide (`Beginner's_guide.html`) contains excellent tutorial content
- Sections like "Before you unpause" and "Managing government" have specific first steps
- Content gets lost when chunked with general wiki material
- Similarity search matches keywords rather than tutorial intent

**Potential Solutions** (to revisit):
1. Weight tutorial content higher in chunking
2. Create separate tutorial-focused embedding database
3. Add query expansion for beginner terms
4. Improve chunk boundaries for tutorial sequences

**Testing Tool**: Created `eu4/test_embeddings.py` - a REPL for testing embeddings interactively.

#### 3. Voice Chat Generalization
**Current State**: Wind Waker voice chat (`waker/voice_chat.py`) is game-specific but has good architecture.

**Reusable Components**:
- Audio capture/playback with PyAudio
- Gemini Live API integration  
- Memory system with mem0
- Screenshot capture with mss
- Async task management
- Profile loading system (already supports `VOICE_GAME` env var)

**Game-Specific Parts Needing Generalization**:
1. Tool definitions (hard-coded Wind Waker tools in CONFIG)
2. Tool handlers (Wind Waker-specific implementations)
3. Controller commands (RetroArch song sequences)
4. Screenshot analysis prompts

**Next Steps**: Design plugin-based architecture where each game provides:
- Game Profile JSON (tools, prompts, configuration)
- Tool Handler Plugin (game-specific implementations)
- Controller Interface (game-specific input handling)
- Analysis Prompts (game-specific screenshot analysis)

### Technical Decisions Made

1. **Build Tools**: Using `wget2` with specific flags for clean HTML-only downloads
2. **Embeddings**: Using `gemini-embedding-001` with 1500 token chunks, 300 token overlap
3. **Testing**: Created interactive REPL for embeddings validation
4. **Architecture**: Moving toward plugin-based system for game-specific functionality

### Files Modified/Created

- `bin/build/eu4_embeddings.sh` - Updated wget2 command
- `game_companion/eu4/test_embeddings.py` - New embeddings testing REPL
- `game_companion/NOTES.md` - This file

### Environment Setup

- EU4 embeddings: `cd game_companion && uv run bin/build/eu4_embeddings.sh`
- Test embeddings: `cd game_companion && uv run eu4/test_embeddings.py`
- Voice chat: `cd waker && poetry run python voice_chat.py`

### Questions for Future Sessions

1. How to best structure the plugin architecture for game companions?
2. Should we create a base `GameCompanion` class that games inherit from?
3. How to handle different controller interfaces (RetroArch vs native vs web-based)?
4. Best way to improve tutorial content discovery in embeddings?

---

*Last updated: Current session*