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
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import LibraryEditModal from '@/app/components/LibraryEditModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const router = useRouter();
  const [libraries, setLibraries] = useState(initialLibraries);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [deletingLibrary, setDeletingLibrary] = useState<Library | null>(null);
  const [reimportingId, setReimportingId] = useState<string | null>(null);

  const handleSave = (updated: Partial<Library>) => {
    // Update the library in the list
    setLibraries(libs =>
      libs.map(lib => (lib.id === updated.id ? { ...lib, ...updated } : lib))
    );
    setEditingLibrary(null);
  };

  const handleDelete = async (library: Library) => {
    try {
      const response = await fetch(`/api/libraries/${library.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete library');
      }

      // Remove from list
      setLibraries(libs => libs.filter(lib => lib.id !== library.id));
      setDeletingLibrary(null);
    } catch (error) {
      console.error('Error deleting library:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete library');
    }
  };

  const handleReimport = async (library: Library) => {
    setReimportingId(library.id);
    try {
      const response = await fetch(`/api/libraries/${library.id}/reimport`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reimport library');
      }

      const result = await response.json();
      
      // Redirect to library page to watch progress
      router.push(`/users/${username}/${library.slug}`);
    } catch (error) {
      console.error('Error reimporting library:', error);
      alert(error instanceof Error ? error.message : 'Failed to reimport library');
      setReimportingId(null);
    }
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {libraries.map((library) => (
          <Card key={library.id} className="h-full hover:shadow-lg transition-shadow relative group">
            {/* Menu Button - Only shown on hover and for own profile */}
            {isOwnProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingLibrary(library);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Metadata
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReimport(library);
                    }}
                    disabled={reimportingId === library.id}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${reimportingId === library.id ? 'animate-spin' : ''}`} />
                    {reimportingId === library.id ? 'Reimporting...' : 'Reimport Library'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingLibrary(library);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Library
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingLibrary !== null} onOpenChange={(open) => !open && setDeletingLibrary(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Library?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingLibrary?.title}&quot;?
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The library and all its metadata</li>
                <li>All concepts and their relationships</li>
                <li>All embeddings and processed data</li>
                <li>Learning progress for all users</li>
              </ul>
              <br />
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLibrary && handleDelete(deletingLibrary)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Library
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
