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

'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function AuthButton() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="h-9 w-24 animate-pulse bg-muted rounded-md" />
    )
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link 
          href={`/users/${session.user.username}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || 'User'}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="text-sm font-medium text-white">
            {session.user.name}
          </span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-white hover:bg-slate-800"
        >
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={() => signIn('github')}
      className="gap-1"
    >
      <span>🚀</span>
      Sign in with GitHub
    </Button>
  )
}
