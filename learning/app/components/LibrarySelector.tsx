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

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { Library, Chapter } from '@/app/page';

type LibrarySelectorProps = {
  libraries: Library[];
  chapters: Chapter[];
  onSelect: (libraryId: string) => void;
};

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
};

function LibraryCard({ lib, onSelect }: { lib: Library; onSelect: (id: string) => void }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-105"
      onClick={() => onSelect(lib.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">{lib.title}</CardTitle>
            <p className="text-sm text-slate-500">by {lib.author}</p>
          </div>
          <div className={`w-4 h-4 rounded-full ${colorMap[lib.color] || 'bg-gray-500'}`} />
        </div>
        <CardDescription className="text-base">{lib.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm text-slate-600">
          <div>
            <span className="font-semibold">{lib.stats.totalConcepts}</span> concepts
          </div>
          <div>•</div>
          <div>
            <span className="font-semibold">~{lib.stats.estimatedHours}</span> hours
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LibrarySelector({ libraries, chapters, onSelect }: LibrarySelectorProps) {
  // Libraries that belong to a chapter are shown inside their chapter section.
  // The `libraries` prop contains only those NOT in any chapter (standalone).
  const hasChapters = chapters.length > 0;
  const hasStandalone = libraries.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Little PAIPer
            </h1>
            <p className="text-xl text-slate-600">
              Learn computer science through Peter Norvig&apos;s teachings
            </p>
          </div>

          {/* Chapters */}
          {hasChapters && (
            <div className="space-y-10 mb-10">
              {chapters.map((chapter) => (
                <section key={chapter.id}>
                  <div className="mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">{chapter.title}</h2>
                    {chapter.description && (
                      <p className="text-slate-500 mt-1">{chapter.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {chapter.libraries.map((lib) => (
                      <LibraryCard key={lib.id} lib={lib} onSelect={onSelect} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Standalone libraries (not grouped into a chapter) */}
          {hasStandalone && (
            <section>
              {hasChapters && (
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Libraries</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {libraries.map((lib) => (
                  <LibraryCard key={lib.id} lib={lib} onSelect={onSelect} />
                ))}
              </div>
            </section>
          )}

          {!hasChapters && !hasStandalone && (
            <div className="text-center text-slate-500 py-12">No libraries yet.</div>
          )}

          <div className="mt-12 text-center text-sm text-slate-500">
            <p>More libraries coming soon!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
