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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LibrarySelector from './components/LibrarySelector';

export type Library = {
  id: string;
  title: string;
  author: string;
  type: string;
  conceptGraphPath: string;
  embeddingsPath: string;
  description: string;
  color: string;
  chapterOrder?: number;
  stats: {
    totalConcepts: number;
    estimatedHours: number;
  };
};

export type Chapter = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  orderIndex?: number;
  libraries: Library[];
};

export default function Home() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    // Fetch standalone libraries and chapters in parallel
    Promise.all([
      fetch('/api/libraries').then(res => res.json()),
      fetch('/api/chapters').then(res => res.json()),
    ])
      .then(([libData, chapterData]) => {
        setLibraries(libData.libraries ?? []);
        setChapters(chapterData.chapters ?? []);
      })
      .catch(err => console.error('Failed to load content:', err));
  }, []);

  return (
    <LibrarySelector
      libraries={libraries}
      chapters={chapters}
      onSelect={(libraryId) => {
        router.push(`/library/${libraryId}`);
      }}
    />
  );
}
