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

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InteractiveLibrary from '../../components/InteractiveLibrary';

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

export default function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { slug } = use(params);
  const libraryId = slug;
  
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);

  // Load library metadata
  useEffect(() => {
    fetch('/api/libraries')
      .then(res => res.json())
      .then(data => {
        const foundLibrary = data.libraries.find((l: Library) => l.id === libraryId);
        if (!foundLibrary) {
          // Library not found, redirect to home
          router.push('/');
          return;
        }
        setLibrary(foundLibrary);
        setLoading(false);
        
        // Update localStorage for recent library
        localStorage.setItem('selectedLibrary', libraryId);
      })
      .catch(err => {
        console.error('Failed to load libraries:', err);
        router.push('/');
      });
  }, [libraryId, router]);

  // Show loading state
  if (loading || !library) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading library...</div>
      </div>
    );
  }

  return (
    <InteractiveLibrary 
      library={{
        id: library.id,
        title: library.title,
        author: library.author,
        type: library.type,
        conceptGraphPath: library.conceptGraphPath,
      }}
      onBack={() => router.push('/')}
      backLabel="← Back to Libraries"
    />
  );
}
