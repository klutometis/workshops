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

// Processing stages for different content types
const PROCESSING_STAGES = {
  youtube: [
    { key: 'download', label: 'Downloading video', percent: 10 },
    { key: 'transcribe', label: 'Transcribing audio', percent: 25 },
    { key: 'analyze', label: 'Analyzing video frames', percent: 40 },
    { key: 'extract', label: 'Extracting concepts', percent: 55 },
    { key: 'map-code', label: 'Mapping code to concepts', percent: 60 },
    { key: 'enrich', label: 'Enriching concepts', percent: 68 },
    { key: 'map-segments', label: 'Mapping segments to concepts', percent: 75 },
    { key: 'embed', label: 'Generating embeddings', percent: 85 },
    { key: 'import', label: 'Importing to database', percent: 95 },
  ],
  markdown: [
    { key: 'extract', label: 'Extracting concepts', percent: 20 },
    { key: 'chunk', label: 'Chunking markdown', percent: 40 },
    { key: 'enrich', label: 'Enriching concepts', percent: 60 },
    { key: 'map', label: 'Mapping chunks to concepts', percent: 70 },
    { key: 'embed', label: 'Generating embeddings', percent: 80 },
    { key: 'import', label: 'Importing to database', percent: 95 },
  ],
  notebook: [
    { key: 'download', label: 'Downloading notebook', percent: 10 },
    { key: 'convert', label: 'Converting to markdown', percent: 20 },
    { key: 'extract', label: 'Extracting concepts', percent: 35 },
    { key: 'chunk', label: 'Chunking content', percent: 50 },
    { key: 'enrich', label: 'Enriching concepts', percent: 65 },
    { key: 'map', label: 'Mapping chunks to concepts', percent: 75 },
    { key: 'embed', label: 'Generating embeddings', percent: 85 },
    { key: 'import', label: 'Importing to database', percent: 95 },
  ],
};

// Parse progress message to extract percentage and stage info
function parseProgress(message: string | null, contentType: string): { percent: number; currentStage: string | null } {
  if (!message) return { percent: 0, currentStage: null };

  // Extract percentage if present (e.g., "Transcribing audio: 25%")
  const percentMatch = message.match(/(\d+)%/);
  if (percentMatch) {
    return { percent: parseInt(percentMatch[1], 10), currentStage: message };
  }

  // Match against known stages to estimate progress
  const stages = PROCESSING_STAGES[contentType as keyof typeof PROCESSING_STAGES] || PROCESSING_STAGES.youtube;
  const lowerMessage = message.toLowerCase();
  
  for (const stage of stages) {
    if (lowerMessage.includes(stage.label.toLowerCase())) {
      return { percent: stage.percent, currentStage: stage.label };
    }
  }

  // Default to 5% if processing but no specific stage detected
  return { percent: 5, currentStage: message };
}

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
    }, 2000); // Poll every 2 seconds for responsive updates

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

          {library.status === 'processing' && (() => {
            const { percent, currentStage } = parseProgress(library.progress_message, library.type);
            const stages = PROCESSING_STAGES[library.type as keyof typeof PROCESSING_STAGES] || PROCESSING_STAGES.youtube;

            return (
              <div className="py-12 max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="text-4xl mb-4 inline-block animate-spin">⚙️</div>
                  <p className="text-lg font-semibold mb-2">Processing Content</p>
                  <p className="text-muted-foreground text-sm">
                    Extracting concepts and generating embeddings. This may take 10-30 minutes.
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-semibold text-blue-600">{percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Processing Stages Checklist */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Processing Stages</h3>
                  <div className="space-y-3">
                    {stages.map((stage) => {
                      const isComplete = percent > stage.percent;
                      const isCurrent = percent >= stage.percent && percent < (stages[stages.indexOf(stage) + 1]?.percent || 100);
                      const isPending = percent < stage.percent;

                      return (
                        <div key={stage.key} className="flex items-center gap-3">
                          {/* Status Icon */}
                          <div className="flex-shrink-0">
                            {isComplete && (
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <span className="text-green-600 text-sm">✓</span>
                              </div>
                            )}
                            {isCurrent && (
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
                              </div>
                            )}
                            {isPending && (
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Stage Label */}
                          <div className="flex-1">
                            <span className={`text-sm ${
                              isComplete ? 'text-green-700 font-medium' :
                              isCurrent ? 'text-blue-700 font-semibold' :
                              'text-gray-500'
                            }`}>
                              {stage.label}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className="flex-shrink-0">
                            {isComplete && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                Done
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded animate-pulse">
                                In Progress
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Current Stage Message */}
                {library.progress_message && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 text-lg">ℹ️</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">Current Status</p>
                        <p className="text-sm text-blue-700">{library.progress_message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground mt-6">
                  This page updates automatically every 2 seconds. You can close this tab and return later.
                </p>
              </div>
            );
          })()}

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
