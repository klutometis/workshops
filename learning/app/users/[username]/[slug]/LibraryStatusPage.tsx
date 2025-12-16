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
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type LibraryStatusPageProps = {
  library: any;
  username: string;
};

export default function LibraryStatusPage({ library: initialLibrary, username }: LibraryStatusPageProps) {
  const [library, setLibrary] = useState(initialLibrary);
  const [isPolling, setIsPolling] = useState(true);
  const router = useRouter();

  // Poll for status updates
  useEffect(() => {
    // Don't poll if already in a terminal state
    if (library.status === 'ready' || library.status === 'failed') {
      setIsPolling(false);
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/libraries/${library.id}`);
        if (response.ok) {
          const updatedLibrary = await response.json();
          setLibrary(updatedLibrary);

          // If processing is complete, stop polling and refresh page
          if (updatedLibrary.status === 'ready' || updatedLibrary.status === 'failed') {
            setIsPolling(false);
            clearInterval(pollInterval);
            
            // Refresh the page to load the interactive library
            if (updatedLibrary.status === 'ready') {
              router.refresh();
            }
          }
        }
      } catch (error) {
        console.error('Error polling library status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [library.id, library.status, router]);
  // Status badge configuration
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      emoji: '⏳',
    },
    processing: {
      label: 'Processing',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      emoji: '⚙️',
    },
    ready: {
      label: 'Ready',
      className: 'bg-green-50 text-green-700 border-green-200',
      emoji: '✅',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-50 text-red-700 border-red-200',
      emoji: '❌',
    },
  };

  const currentStatus = statusConfig[library.status as keyof typeof statusConfig];

  // Type badge configuration
  const typeConfig = {
    youtube: { emoji: '▶️', label: 'YouTube Video' },
    notebook: { emoji: '📓', label: 'Jupyter Notebook' },
    markdown: { emoji: '📝', label: 'Markdown Document' },
  };

  const typeInfo = typeConfig[library.type as keyof typeof typeConfig];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href={`/users/${username}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-block text-sm"
      >
        ← Back to @{username}
      </Link>

      {/* Library Header */}
      <Card className="mb-6">
        <CardHeader>
          {/* Status and Type Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${currentStatus.className}`}>
              {currentStatus.emoji} {currentStatus.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {typeInfo.emoji} {typeInfo.label}
            </span>
            {isPolling && (
              <span className="text-xs text-muted-foreground animate-pulse">
                • Checking for updates...
              </span>
            )}
          </div>

          {/* Title */}
          <CardTitle className="text-3xl">{library.title}</CardTitle>

          {/* Author */}
          <CardDescription className="flex items-center gap-2 mt-2">
            {library.github_avatar && (
              <Image
                src={library.github_avatar}
                alt={library.github_name || library.github_login}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span>by {library.github_name || library.github_login}</span>
          </CardDescription>
        </CardHeader>

        {library.source_url && (
          <CardContent>
            <a
              href={library.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              🔗 View Original Source
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </CardContent>
        )}
      </Card>

      {/* Content Area */}
      <Card>
        <CardContent className="pt-6">
          {library.status === 'pending' && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">⏳</p>
              <p className="text-lg font-semibold mb-2">Processing Starting Soon</p>
              <p className="text-muted-foreground text-sm">
                This library is queued for processing. Concepts will be extracted shortly.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                This page will update automatically. You can close this tab and return later.
              </p>
            </div>
          )}

          {library.status === 'processing' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 inline-block animate-spin">⚙️</div>
              <p className="text-lg font-semibold mb-2">Processing Content</p>
              <p className="text-muted-foreground text-sm">
                Extracting concepts and generating embeddings. This may take 10-30 minutes.
              </p>
              {library.progress_message && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">{library.progress_message}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                This page will update automatically. You can close this tab and return later.
              </p>
            </div>
          )}

          {library.status === 'failed' && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">❌</p>
              <p className="text-lg font-semibold mb-2">Processing Failed</p>
              <p className="text-muted-foreground text-sm mb-4">
                There was an error processing this library.
              </p>
              {library.error_message && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-left max-w-2xl mx-auto">
                  <p className="text-sm font-mono text-red-700">{library.error_message}</p>
                </div>
              )}
            </div>
          )}

          {library.status === 'ready' && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-lg font-semibold mb-2">Library Ready</p>
              <p className="text-muted-foreground text-sm">
                This library has been processed but concept data could not be loaded.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="mt-4 text-xs text-muted-foreground">
        <div className="flex gap-6">
          <span>
            <span className="font-semibold">Created:</span> {new Date(library.created_at).toLocaleDateString()}
          </span>
          {library.processed_at && (
            <span>
              <span className="font-semibold">Processed:</span> {new Date(library.processed_at).toLocaleDateString()}
            </span>
          )}
          <span>
            <span className="font-semibold">Visibility:</span> {library.is_public ? 'Public' : 'Private'}
          </span>
        </div>
      </div>
    </div>
  );
}
