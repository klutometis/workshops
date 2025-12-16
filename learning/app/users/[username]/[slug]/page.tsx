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

import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import LibraryStatusPage from './LibraryStatusPage';
import LibraryInteractivePage from './LibraryInteractivePage';

type Params = {
  username: string;
  slug: string;
};

async function getLibraryData(username: string, slug: string) {
  // Get library with user info
  const result = await pool.query(
    `SELECT l.*, u.github_login, u.github_name, u.github_avatar
     FROM libraries l
     JOIN users u ON l.user_id = u.id
     WHERE u.github_login = $1 AND l.slug = $2`,
    [username, slug]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const library = result.rows[0];

  // Get concept graph data if library is ready
  let conceptGraphData = null;
  if (library.status === 'ready' && library.concept_graph_data) {
    conceptGraphData = library.concept_graph_data;
  }

  return {
    ...library,
    conceptGraphData,
  };
}

export default async function LibraryPage({ params }: { params: Promise<Params> }) {
  // Await params (Next.js 15 requirement)
  const { username, slug } = await params;
  
  const library = await getLibraryData(username, slug);

  if (!library) {
    notFound();
  }

  // If library is ready and has concepts, show interactive experience
  if (library.status === 'ready' && library.conceptGraphData) {
    return (
      <LibraryInteractivePage
        library={library}
        username={username}
      />
    );
  }

  // Otherwise show status page
  return (
    <LibraryStatusPage
      library={library}
      username={username}
    />
  );
}
