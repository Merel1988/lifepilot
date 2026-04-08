import "next-auth";

declare module "next-auth" {
  interface Session {
    microsoftConnected?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    microsoftAccessToken?: string;
    microsoftRefreshToken?: string;
    microsoftExpiresAt?: number;
  }
}
