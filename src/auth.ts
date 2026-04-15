import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const providers: NextAuthConfig["providers"] = [Apple, GitHub, Google];

// Only include Microsoft provider if credentials are set
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email User.Read Calendars.Read Mail.Read offline_access",
        },
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, account }) {
      // Persist Microsoft tokens in JWT on initial sign-in
      if (account?.provider === "microsoft-entra-id") {
        token.microsoftAccessToken = account.access_token;
        token.microsoftRefreshToken = account.refresh_token;
        token.microsoftExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose provider info to client
      if (token.microsoftAccessToken) {
        session.microsoftConnected = true;
      }
      return session;
    },
  },
});
