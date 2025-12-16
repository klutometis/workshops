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

import { notFound } from 'next/navigation';
import { getUserByUsername, getLibrariesByUsername } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  // Await params (Next.js 15 requirement)
  const { username } = await params;
  
  // Fetch user and their libraries in parallel
  const [user, libraries] = await Promise.all([
    getUserByUsername(username),
    getLibrariesByUsername(username)
  ]);

  // 404 if user doesn't exist
  if (!user) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* User Profile Header */}
      <div className="mb-8 flex items-center gap-6">
        {user.github_avatar && (
          <Image
            src={user.github_avatar}
            alt={user.github_name || user.github_login}
            width={96}
            height={96}
            className="rounded-full"
          />
        )}
        <div>
          <h1 className="text-4xl font-bold mb-2">
            {user.github_name || user.github_login}
          </h1>
          <p className="text-muted-foreground text-lg">
            @{user.github_login}
          </p>
        </div>
      </div>

      {/* Libraries Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">
          Public Libraries ({libraries.length})
        </h2>
      </div>

      {/* Empty State */}
      {libraries.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground text-lg mb-2">
              No public libraries yet
            </p>
            <p className="text-muted-foreground text-sm">
              {user.github_name || user.github_login} hasn't published any learning content.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Libraries Grid */}
      {libraries.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {libraries.map((library: any) => (
            <Link key={library.id} href={`/library/${library.slug}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{library.title}</CardTitle>
                  <CardDescription>
                    {library.author}
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
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
