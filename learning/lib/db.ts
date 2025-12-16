/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.LEARNING_DATABASE_URL_PROXY || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export default pool;

// Helper: Get library by video ID
export async function getLibraryByVideoId(videoId: string) {
  const result = await pool.query(
    'SELECT * FROM libraries WHERE video_id = $1',
    [videoId]
  );
  return result.rows[0] || null;
}

// Helper: Get library by ID (UUID)
export async function getLibraryById(libraryId: string) {
  const result = await pool.query(
    'SELECT * FROM libraries WHERE id = $1',
    [libraryId]
  );
  return result.rows[0] || null;
}

// Helper: Get library by slug (human-readable identifier)
export async function getLibraryBySlug(slug: string) {
  const result = await pool.query(
    'SELECT * FROM libraries WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

// Helper: Get all libraries
export async function getAllLibraries() {
  const result = await pool.query(
    'SELECT * FROM libraries ORDER BY title'
  );
  return result.rows;
}

// Helper: Get user by GitHub username
export async function getUserByUsername(username: string) {
  const result = await pool.query(
    'SELECT * FROM users WHERE github_login = $1',
    [username]
  );
  return result.rows[0] || null;
}

// Helper: Get all public libraries for a user
export async function getLibrariesByUsername(username: string) {
  const result = await pool.query(
    `SELECT l.* FROM libraries l
     JOIN users u ON l.user_id = u.id
     WHERE u.github_login = $1 AND l.is_public = true
     ORDER BY l.created_at DESC`,
    [username]
  );
  return result.rows;
}

// Helper: Get concept graph for a library
export async function getConceptGraph(libraryId: string) {
  const result = await pool.query(
    'SELECT * FROM get_concept_graph($1)',
    [libraryId]
  );
  return result.rows[0] || null;
}

// Helper: Semantic search for segments
export async function searchSegments(
  queryEmbedding: number[],
  libraryId: string,
  matchThreshold: number = 0.5,
  matchCount: number = 10
) {
  // Normalize query embedding (required for 1536D per Gemini docs)
  const magnitude = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
  const normalizedEmbedding = queryEmbedding.map(val => val / magnitude);
  
  // Convert JS array to PostgreSQL vector format
  const vectorString = `[${normalizedEmbedding.join(',')}]`;
  
  const result = await pool.query(
    'SELECT * FROM search_segments($1::vector, $2, $3, $4)',
    [vectorString, libraryId, matchThreshold, matchCount]
  );
  return result.rows;
}

// Helper: Get segment details by ID
export async function getSegmentById(segmentId: string) {
  const result = await pool.query(
    'SELECT * FROM segments WHERE id = $1',
    [segmentId]
  );
  return result.rows[0] || null;
}
