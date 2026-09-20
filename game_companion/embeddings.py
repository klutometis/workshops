#!/usr/bin/env python3
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Create embeddings for game companion knowledge bases."""

import argparse
import json
from typing import List, Tuple

from google import genai
from google.genai import types


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks


def create_embeddings(
    input_file: str,
    output_file: str,
    chunk_size: int = 1000,
    overlap: int = 200,
    model: str = "gemini-embedding-001",
) -> None:
    """Create embeddings from an input text file and write JSON to output_file."""
    client = genai.Client()

    # Read corpus
    with open(input_file, "r") as f:
        text = f.read()

    # Split into chunks
    chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
    print(f"Created {len(chunks)} chunks (chunk_size={chunk_size}, overlap={overlap})")

    # Create embeddings
    embeddings_data = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)}")

        response = client.models.embed_content(
            model=model,
            contents=chunk,
            config=types.EmbedContentConfig(task_type="retrieval_document"),
        )

        embeddings_data.append(
            {"chunk_id": i, "text": chunk, "embedding": response.embeddings[0].values}
        )

    # Save to file
    with open(output_file, "w") as f:
        json.dump(embeddings_data, f)

    print(f"Embeddings saved to {output_file}!")


def main():
    parser = argparse.ArgumentParser(description="Create embeddings for a text corpus")
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Input text file",
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Output JSON file",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Chunk size in characters (default: 1000)",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=200,
        help="Overlap between chunks in characters (default: 200)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-embedding-001",
        help="Embedding model name (default: gemini-embedding-001)",
    )
    args = parser.parse_args()

    create_embeddings(
        input_file=args.input,
        output_file=args.output,
        chunk_size=args.chunk_size,
        overlap=args.overlap,
        model=args.model,
    )


if __name__ == "__main__":
    main()