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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Chapter = {
  id: string;
  title: string;
  slug: string;
};

type Library = {
  id: string;
  title: string;
  author: string;
  description?: string;
  is_public: boolean;
  chapter_id?: string | null;
  chapter_order?: number | null;
};

type LibraryEditModalProps = {
  library: Library;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Partial<Library>) => void;
  isAdmin?: boolean;
};

const CREATE_NEW_VALUE = '__create_new__';

export default function LibraryEditModal({
  library,
  open,
  onOpenChange,
  onSave,
  isAdmin = false,
}: LibraryEditModalProps) {
  const [title, setTitle] = useState(library.title);
  const [description, setDescription] = useState(library.description || '');
  const [isPublic, setIsPublic] = useState(library.is_public);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Book (chapter) state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    library.chapter_id || ''
  );
  const [chapterOrder, setChapterOrder] = useState<string>(
    library.chapter_order != null ? String(library.chapter_order) : ''
  );
  const [isCreatingBook, setIsCreatingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');

  // Fetch user's books when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingChapters(true);
    fetch('/api/chapters?mine=true')
      .then(res => res.json())
      .then(data => setChapters(data.chapters ?? []))
      .catch(() => setChapters([]))
      .finally(() => setLoadingChapters(false));
  }, [open]);

  // Reset form when library prop changes (e.g. opening modal for a different library)
  useEffect(() => {
    setTitle(library.title);
    setDescription(library.description || '');
    setIsPublic(library.is_public);
    setSelectedChapterId(library.chapter_id || '');
    setChapterOrder(library.chapter_order != null ? String(library.chapter_order) : '');
    setIsCreatingBook(false);
    setNewBookTitle('');
    setError(null);
  }, [library]);

  const handleChapterSelect = (value: string) => {
    if (value === CREATE_NEW_VALUE) {
      setIsCreatingBook(true);
      setSelectedChapterId('');
    } else {
      setIsCreatingBook(false);
      setNewBookTitle('');
      setSelectedChapterId(value);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (title.length > 200) {
      setError('Title must be 200 characters or less');
      return;
    }

    if (description.length > 1000) {
      setError('Description must be 1000 characters or less');
      return;
    }

    if (isCreatingBook && !newBookTitle.trim()) {
      setError('Book title is required');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // If creating a new book, do that first
      let chapterId: string | null = selectedChapterId || null;

      if (isCreatingBook) {
        const createRes = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newBookTitle.trim() }),
        });

        if (!createRes.ok) {
          const data = await createRes.json();
          throw new Error(data.error || 'Failed to create book');
        }

        const newChapter = await createRes.json();
        chapterId = newChapter.id;
      }

      // Now PATCH the library
      const parsedOrder = chapterOrder.trim() !== '' ? parseInt(chapterOrder, 10) : null;

      const response = await fetch(`/api/libraries/${library.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          chapter_id: chapterId,
          chapter_order: parsedOrder,
          ...(isAdmin && { is_public: isPublic }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update library');
      }

      const updated = await response.json();
      onSave(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Library Metadata</DialogTitle>
          <DialogDescription>
            Update the title, description, and book assignment for your library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter library title"
              maxLength={200}
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500">
              {title.length}/200 characters
            </p>
          </div>

          {/* Author (read-only) */}
          <div className="space-y-2">
            <label htmlFor="author" className="text-sm font-medium text-gray-500">
              Author
            </label>
            <Input
              id="author"
              value={library.author}
              disabled
              className="bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">
              Author cannot be changed
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description or abstract for this library"
              rows={4}
              maxLength={1000}
              disabled={isSaving}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {description.length}/1000 characters
            </p>
          </div>

          {/* Book assignment */}
          <div className="space-y-2 pt-2 border-t">
            <label htmlFor="book" className="text-sm font-medium">
              Book
            </label>
            <select
              id="book"
              value={isCreatingBook ? CREATE_NEW_VALUE : selectedChapterId}
              onChange={(e) => handleChapterSelect(e.target.value)}
              disabled={isSaving || loadingChapters}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">None (standalone library)</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
              <option value={CREATE_NEW_VALUE}>Create new book...</option>
            </select>
            {loadingChapters && (
              <p className="text-xs text-gray-400">Loading books...</p>
            )}

            {/* New book title input */}
            {isCreatingBook && (
              <div className="space-y-1 pl-2 border-l-2 border-blue-200">
                <label htmlFor="new-book-title" className="text-xs font-medium text-blue-700">
                  New book title
                </label>
                <Input
                  id="new-book-title"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="e.g. Paradigms of AI Programming"
                  maxLength={200}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {/* Chapter order */}
          <div className="space-y-2">
            <label htmlFor="chapter-order" className="text-sm font-medium">
              Chapter number
            </label>
            <Input
              id="chapter-order"
              type="number"
              min={1}
              value={chapterOrder}
              onChange={(e) => setChapterOrder(e.target.value)}
              placeholder="e.g. 1"
              disabled={isSaving || (!selectedChapterId && !isCreatingBook)}
              className={!selectedChapterId && !isCreatingBook ? 'bg-gray-50 text-gray-400' : ''}
            />
            <p className="text-xs text-gray-500">
              Position of this library within its book (optional)
            </p>
          </div>

          {/* Public/Private toggle (admin only) */}
          {isAdmin && (
            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isSaving}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium">
                  Public (visible on homepage)
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                Only administrators can change library visibility
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
