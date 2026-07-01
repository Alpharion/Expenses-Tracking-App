declare module "next-auth" {
    interface Session {
        accessToken: string
        refreshToken: string
        expiresAt: number
    }
}

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export const config: NextAuthConfig = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization : {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly", 
                    access_type: "offline",
                    prompt: "consent"
                }
            }
        })
    ],

    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.expiresAt = account.expires_at
            }
            return token
        }, 
        async session( { session, token }) {
            session.accessToken = token.accessToken as string
            session.refreshToken = token.refreshToken as string
            session.expiresAt = token.expiresAt as number
            return session
        }
    },
    session: { strategy: "jwt"}
}

export const { handlers, signIn, signOut, auth } = NextAuth(config)