# EU4 Embeddings Build

This document describes how to build a local EU4 knowledge base for the game companion using the Paradox wiki.

Outputs (by default)
- Raw crawl: game_companion/plugins/eu4/rag/site/
- Corpus text: game_companion/plugins/eu4/rag/eu4_guide.txt
- Embeddings: game_companion/plugins/eu4/rag/eu4_walkthrough_embeddings.json

Prerequisites
- wget
- One of: lynx, w3m, or html2text (lynx recommended for clean text)
- Python dependencies for the project (for google genai client)

Usage
- From the repository root:

  - Make the script executable:
    chmod +x bin/build/eu4_embeddings.sh

  - Run the build:
    bin/build/eu4_embeddings.sh

After building
- Ensure you run the voice chat from the repo root so the relative path in profile.json resolves:
  VOICE_GAME=eu4 GOOGLE_API_KEY=... poetry run python waker/voice_chat.py

Notes
- Politeness: The script uses moderate throttling and respects robots.txt. You can further restrict by replacing the recursive crawl with a curated seed list if needed.
- Licensing: The EU4 wiki content is typically CC BY-SA. The script writes an ATTRIBUTION.txt next to the embeddings.
- Tuning: You can adjust chunk size, overlap, and model via the embedding script:
  python waker/create_embeddings.py --help
