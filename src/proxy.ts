import { auth } from "@/auth";

export default auth;

export const config = {
  matcher: [
    // Protect everything except static files, auth routes, and public assets
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon-.*|manifest.json).*)",
  ],
};
