import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * De inlogproviders.
 *
 * GitHub krijgt expliciet een `issuer` mee.
 *
 * GitHub is RFC 9207 gaan gebruiken en stuurt sindsdien een `iss`-parameter mee
 * terug in de callback. `oauth4webapi` vergelijkt die met de issuer van de
 * provider, en die was in `@auth/core` 0.41 voor GitHub niet gezet — dan valt hij
 * terug op de placeholder "https://authjs.dev", wat nooit klopt. Resultaat:
 * inloggen faalde met CallbackRouteError / "unexpected iss response parameter
 * value" en de gebruiker zag "There is a problem with the server configuration".
 *
 * Upstream staat deze regel nu ook in de provider zelf, dus bij een latere
 * next-auth-upgrade is dit niet fout maar dubbel.
 *
 * Apple en Google stonden hier ook, maar zonder secrets in Vercel liep elke klik
 * op die knoppen op dezelfde foutpagina uit. Apple is bovendien niet gratis: dat
 * vraagt een Developer Program-lidmaatschap (€99/jaar) en geeft geen toegang tot
 * de iCloud-agenda — inloggen met Apple levert alleen naam en e-mail. Zet ze pas
 * terug samen met de bijbehorende secrets.
 */
const providers: NextAuthConfig["providers"] = [
  GitHub({ issuer: "https://github.com/login/oauth" }),
];

/** Microsoft doet alleen mee als de secrets er zijn; anders faalt de knop. */
export const microsoftEnabled = Boolean(
  process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
);

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
