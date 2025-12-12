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

type Library = {
  id: string;
  title: string;
  author: string;
  type: string;
  conceptGraphPath: string;
  embeddingsPath: string;
  description: string;
  color: string;
  stats: {
    totalConcepts: number;
    estimatedHours: number;
  };
};

export default function Home() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([]);

  useEffect(() => {
    fetch('/api/libraries')
      .then(res => res.json())
      .then(data => setLibraries(data.libraries))
      .catch(err => console.error('Failed to load libraries:', err));
  }, []);

  return (
    <LibrarySelector 
      libraries={libraries}
      onSelect={(libraryId) => {
        // Navigate to the library detail page
        router.push(`/library/${libraryId}`);
      }}
    />
  );
}
