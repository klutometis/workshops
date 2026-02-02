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
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, MoreVertical } from 'lucide-react';
import LibraryEditModal from '@/app/components/LibraryEditModal';

type Library = {
  id: string;
  title: string;
  author: string;
  description?: string;
  type: string;
  slug: string;
  status: string;
  total_concepts: number;
  is_public: boolean;
};

type LibrariesGridProps = {
  libraries: Library[];
  username: string;
  isOwnProfile: boolean;
};

export default function LibrariesGrid({ libraries: initialLibraries, username, isOwnProfile }: LibrariesGridProps) {
  const [libraries, setLibraries] = useState(initialLibraries);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);

  const handleSave = (updated: Partial<Library>) => {
    // Update the library in the list
    setLibraries(libs =>
      libs.map(lib => (lib.id === updated.id ? { ...lib, ...updated } : lib))
    );
    setEditingLibrary(null);
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {libraries.map((library) => (
          <Card key={library.id} className="h-full hover:shadow-lg transition-shadow relative group">
            {/* Edit Button - Only shown on hover and for own profile */}
            {isOwnProfile && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingLibrary(library);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}

            <Link href={`/users/${username}/${library.slug}`}>
              <div className="cursor-pointer">
                <CardHeader>
                  <CardTitle>{library.title}</CardTitle>
                  <CardDescription>
                    {library.description || library.author}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{library.type}</span>
                    {library.total_concepts > 0 && (
                      <span>{library.total_concepts} concepts</span>
                    )}
                    {library.status === 'ready' && (
                      <span className="text-green-600 font-medium">✓ Ready</span>
                    )}
                    {library.status === 'processing' && (
                      <span className="text-yellow-600">⏳ Processing</span>
                    )}
                    {!library.is_public && (
                      <span className="text-gray-500">🔒 Private</span>
                    )}
                  </div>
                </CardContent>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      {editingLibrary && (
        <LibraryEditModal
          library={editingLibrary}
          open={true}
          onOpenChange={(open) => !open && setEditingLibrary(null)}
          onSave={handleSave}
          isAdmin={false} // TODO: Add admin check from session
        />
      )}
    </>
  );
}
