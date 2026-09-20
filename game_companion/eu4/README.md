# EU4 Game Companion

This directory contains the Europa Universalis IV companion configuration and data.

## Files

- `profile.json` - Configuration for the EU4 companion (system prompts, tools, etc.)
- `build_embeddings.sh` - Script to build the knowledge base from EU4 wiki
- `embeddings.json` - Generated embeddings (created by build script)
- `corpus.txt` - Generated text corpus (created by build script)
- `site/` - Downloaded HTML files from the wiki (created by build script)

## Setup

1. Build the embeddings:
   ```bash
   cd game_companion
   ./eu4/build_embeddings.sh
   ```

2. Run the companion:
   ```bash
   cd ../..  # Back to project root
   VOICE_GAME=eu4 GOOGLE_API_KEY=your-key poetry run python waker/voice_chat.py
   ```

## Customization

Edit `profile.json` to:
- Modify the system instruction for different companion behavior
- Add or remove tools
- Adjust visual analysis prompts
- Change RAG parameters (chunk size, top_k results, etc.)

## Notes

- The build script downloads tutorial-focused pages from the EU4 wiki
- Content is from https://eu4.paradoxwikis.com/ (CC BY-SA license)
- The companion uses Gemini's live API for voice interaction