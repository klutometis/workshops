import { NextAuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { Pool } from "pg"

// Database connection for auth
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Save GitHub user to database
      if (account?.provider === "github" && profile) {
        try {
          const githubProfile = profile as any
          
          await pool.query(
            `INSERT INTO users (github_id, github_login, github_name, github_avatar, github_email, last_login_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (github_id) 
             DO UPDATE SET 
               github_name = EXCLUDED.github_name,
               github_avatar = EXCLUDED.github_avatar,
               github_email = EXCLUDED.github_email,
               last_login_at = NOW()`,
            [
              githubProfile.id?.toString(),
              githubProfile.login,
              githubProfile.name,
              githubProfile.avatar_url,
              githubProfile.email,
            ]
          )
          
          console.log(`✅ User ${githubProfile.login} authenticated and saved to database`)
        } catch (error) {
          console.error("❌ Failed to save user to database:", error)
          // Still allow sign in even if DB save fails
        }
      }
      return true
    },
    async session({ session, token }) {
      // Add user ID to session
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
}
