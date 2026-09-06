import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // hd = UX-level hint only, pre-filters Google's account picker.
      // This is NOT a security boundary by itself - see the signIn
      // callback below, which is the check that actually matters.
      authorization: {
        params: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // The real security check: verify server-side that the email Google
    // gave us actually belongs to the college domain. Never trust the
    // hd login hint alone - it can be bypassed client-side.
    async signIn({ profile }) {
      const email = (profile as { email?: string } | undefined)?.email?.toLowerCase();
      if (!email) return false;
      const domain = email.split("@")[1];
      return domain === ALLOWED_DOMAIN.toLowerCase();
    },
    async session({ session }) {
      const email = session.user?.email?.toLowerCase();
      if (email) {
        (session as any).isAdmin = ADMIN_EMAILS.includes(email);
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
