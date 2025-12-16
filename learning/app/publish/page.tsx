'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type SourceType = 'youtube' | 'notebook' | 'markdown' | 'unknown';

interface DetectedSource {
  type: SourceType;
  videoId?: string;
  isValid: boolean;
  message?: string;
}

function detectSourceType(url: string): DetectedSource {
  if (!url.trim()) {
    return { type: 'unknown', isValid: false };
  }

  // YouTube detection
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      videoId: youtubeMatch[1],
      isValid: true,
      message: `YouTube video: ${youtubeMatch[1]}`,
    };
  }

  // GitHub notebook detection
  if (url.includes('github.com') && url.endsWith('.ipynb')) {
    return {
      type: 'notebook',
      isValid: true,
      message: 'Jupyter Notebook from GitHub',
    };
  }

  // GitHub markdown detection
  if (url.includes('github.com') && url.endsWith('.md')) {
    return {
      type: 'markdown',
      isValid: true,
      message: 'Markdown file from GitHub',
    };
  }

  // Generic markdown URL
  if (url.endsWith('.md')) {
    return {
      type: 'markdown',
      isValid: true,
      message: 'Markdown file',
    };
  }

  // Generic notebook URL
  if (url.endsWith('.ipynb')) {
    return {
      type: 'notebook',
      isValid: true,
      message: 'Jupyter Notebook',
    };
  }

  return {
    type: 'unknown',
    isValid: false,
    message: 'Unsupported URL format. Please provide a YouTube video, GitHub notebook (.ipynb), or markdown file (.md).',
  };
}

export default function PublishPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedSource = detectSourceType(url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!detectedSource.isValid) {
      setError(detectedSource.message || 'Invalid URL');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish library');
      }

      // Redirect to the user's library status page
      router.push(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/api/auth/signin?callbackUrl=/publish');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Publish Learning Content
          </h1>
          <p className="text-gray-600">
            Import educational content from YouTube, Jupyter notebooks, or markdown files
          </p>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Content URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://github.com/..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Source type detection feedback */}
            {url && detectedSource.message && (
              <div
                className={`p-4 rounded-lg ${
                  detectedSource.isValid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {detectedSource.isValid ? (
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        detectedSource.isValid ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {detectedSource.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={!detectedSource.isValid || isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Publishing...
                  </>
                ) : (
                  'Publish Library'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Supported sources:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="mr-2">📺</span>
                <span>
                  <strong>YouTube videos:</strong> Educational tutorials, lectures, coding sessions
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">📓</span>
                <span>
                  <strong>Jupyter Notebooks:</strong> From GitHub or direct URLs (.ipynb files)
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">📝</span>
                <span>
                  <strong>Markdown files:</strong> Documentation, tutorials, guides (.md files)
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Processing typically takes 10-30 minutes depending on content length.
            <br />
            You'll be able to close the tab and check back later.
          </p>
        </div>
      </div>
    </div>
  );
}
