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

import { useState } from 'react';
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

// Full card for standalone libraries
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
          <div>&middot;</div>
          <div>
            <span className="font-semibold">~{lib.stats.estimatedHours}</span> hours
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Collapsible book section with compact chapter list
function BookSection({
  chapter,
  onSelect,
  defaultOpen,
}: {
  chapter: Chapter;
  onSelect: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const libs = [...chapter.libraries].sort(
    (a, b) => (a.chapterOrder ?? 999) - (b.chapterOrder ?? 999)
  );

  const totalConcepts = libs.reduce((sum, l) => sum + (l.stats.totalConcepts || 0), 0);
  const totalHours = libs.reduce((sum, l) => sum + (l.stats.estimatedHours || 0), 0);

  return (
    <section className="border border-slate-200 rounded-xl bg-white shadow-sm">
      {/* Clickable header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            open ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-slate-800 truncate">{chapter.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {libs.length} chapter{libs.length !== 1 ? 's' : ''}
            {totalConcepts > 0 && <> &middot; {totalConcepts} concepts</>}
            {totalHours > 0 && <> &middot; ~{totalHours} hours</>}
          </p>
        </div>
      </button>

      {/* Expanded: compact numbered list */}
      {open && (
        <div className="px-6 pb-4">
          <div className="border-t border-slate-100 pt-3">
            {libs.map((lib, idx) => {
              const num = lib.chapterOrder ?? idx + 1;
              return (
                <button
                  key={lib.id}
                  onClick={() => onSelect(lib.id)}
                  className="w-full flex items-baseline gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <span className="text-sm text-slate-400 font-mono w-6 text-right flex-shrink-0">
                    {num}.
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                      {lib.title}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                    {lib.stats.totalConcepts > 0 && (
                      <>{lib.stats.totalConcepts} concepts</>
                    )}
                    {lib.stats.totalConcepts > 0 && lib.stats.estimatedHours > 0 && (
                      <> &middot; </>
                    )}
                    {lib.stats.estimatedHours > 0 && (
                      <>~{lib.stats.estimatedHours} hrs</>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default function LibrarySelector({ libraries, chapters, onSelect }: LibrarySelectorProps) {
  const hasChapters = chapters.length > 0;
  const hasStandalone = libraries.length > 0;

  // Always start collapsed so standalone libraries are visible
  const defaultOpen = false;

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

          {/* Books (collapsible) */}
          {hasChapters && (
            <div className="space-y-4 mb-10">
              {chapters.map((chapter) => (
                <BookSection
                  key={chapter.id}
                  chapter={chapter}
                  onSelect={onSelect}
                  defaultOpen={defaultOpen}
                />
              ))}
            </div>
          )}

          {/* Standalone libraries (full cards) */}
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
