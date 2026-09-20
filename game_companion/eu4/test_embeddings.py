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

"""
Simple REPL to test EU4 embeddings interactively.
Usage: cd game_companion && python eu4/test_embeddings.py
"""

import json
import numpy as np
from google import genai
from google.genai import types


class EU4EmbeddingsREPL:
    def __init__(self, embeddings_file="./eu4/embeddings.json"):
        print(f"🔍 Loading EU4 embeddings from {embeddings_file}...")
        
        with open(embeddings_file, 'r') as f:
            self.embedding_db = json.load(f)
        
        # Convert embeddings to numpy arrays for faster computation
        self.embeddings_matrix = np.array([
            entry["embedding"] for entry in self.embedding_db
        ])
        
        self.client = genai.Client()
        print(f"✅ Loaded {len(self.embedding_db)} chunks")
        print("Type 'quit' or 'exit' to quit, 'help' for commands\n")

    def create_query_embedding(self, query_text: str) -> np.ndarray:
        """Create embedding for query text"""
        response = self.client.models.embed_content(
            model="gemini-embedding-001",
            contents=query_text,
            config=types.EmbedContentConfig(task_type="retrieval_query"),
        )
        return np.array(response.embeddings[0].values)

    def cosine_similarity(self, query_embedding: np.ndarray) -> np.ndarray:
        """Calculate cosine similarity between query and all chunks"""
        # Normalize vectors
        query_norm = query_embedding / np.linalg.norm(query_embedding)
        embeddings_norm = self.embeddings_matrix / np.linalg.norm(self.embeddings_matrix, axis=1, keepdims=True)
        
        # Calculate cosine similarity
        similarities = np.dot(embeddings_norm, query_norm)
        return similarities

    def search(self, query: str, top_k: int = 5, similarity_threshold: float = 0.5):
        """Search for relevant chunks"""
        print(f"🔍 Searching for: '{query}'")
        
        # Create query embedding
        query_embedding = self.create_query_embedding(query)
        
        # Calculate similarities
        similarities = self.cosine_similarity(query_embedding)
        
        # Get top results
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for i, idx in enumerate(top_indices):
            similarity = similarities[idx]
            if similarity >= similarity_threshold:
                results.append({
                    'rank': i + 1,
                    'similarity': similarity,
                    'chunk_id': self.embedding_db[idx]['chunk_id'],
                    'text': self.embedding_db[idx]['text']
                })
        
        return results

    def print_results(self, results):
        """Print search results nicely"""
        if not results:
            print("❌ No results found above similarity threshold")
            return
        
        print(f"📊 Found {len(results)} relevant chunks:\n")
        
        for result in results:
            print(f"🏆 Rank {result['rank']} (similarity: {result['similarity']:.3f})")
            print(f"📝 Chunk ID: {result['chunk_id']}")
            
            # Show first 200 chars of text
            text_preview = result['text'][:200].replace('\n', ' ').strip()
            if len(result['text']) > 200:
                text_preview += "..."
            print(f"💬 Preview: {text_preview}")
            print("-" * 80)

    def run(self):
        """Main REPL loop"""
        while True:
            try:
                query = input("EU4> ").strip()
                
                if query.lower() in ['quit', 'exit', 'q']:
                    print("👋 Goodbye!")
                    break
                
                elif query.lower() == 'help':
                    print("Commands:")
                    print("  <query>     - Search embeddings")
                    print("  help        - Show this help")
                    print("  quit/exit   - Exit REPL")
                    print("  stats       - Show database stats")
                    continue
                
                elif query.lower() == 'stats':
                    print(f"📊 Database stats:")
                    print(f"   Total chunks: {len(self.embedding_db)}")
                    print(f"   Embedding dimensions: {len(self.embedding_db[0]['embedding'])}")
                    total_chars = sum(len(chunk['text']) for chunk in self.embedding_db)
                    print(f"   Total characters: {total_chars:,}")
                    continue
                
                elif not query:
                    continue
                
                # Search embeddings
                results = self.search(query)
                self.print_results(results)
                print()
                
            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")


if __name__ == "__main__":
    repl = EU4EmbeddingsREPL()
    repl.run()