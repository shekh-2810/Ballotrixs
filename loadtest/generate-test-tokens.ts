/**
 * Generates valid, signed NextAuth session cookies for a list of test
 * emails - WITHOUT going through a real Google login. k6 can't click
 * through Google's OAuth screen, so this mints tokens the same way
 * NextAuth itself does (same secret, same encoding), which your server
 * will accept as a genuinely logged-in session.
 *
 * SAFETY: only ever run this against a staging environment with its own
 * database. It requires NEXTAUTH_SECRET, and anyone with that value plus
 * this script could "log in" as any email. Never commit the generated
 * tokens file, and never run this against production.
 *
 * Usage:
 *   1. Make sure the emails you list below are already on the Allowlist
 *      in whichever database this NEXTAUTH_SECRET/DATABASE_URL points to
 *      (upload them via the admin panel as usual, or seed directly).
 *   2. npx tsx loadtest/generate-test-tokens.ts
 *   3. This writes loadtest/tokens.json, an array of { email, cookie }.
 */

import { encode } from "next-auth/jwt";
import fs from "fs";
import path from "path";

const NUM_TOKENS = Number(process.env.NUM_TOKENS ?? 1500);
const EMAIL_DOMAIN = process.env.ALLOWED_DOMAIN ?? "vitbhopal.ac.in";
const SECRET = process.env.NEXTAUTH_SECRET;
const IS_HTTPS = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
const COOKIE_NAME = IS_HTTPS ? "__Secure-next-auth.session-token" : "next-auth.session-token";

if (!SECRET) {
  console.error("Set NEXTAUTH_SECRET (and ideally NEXTAUTH_URL) in your environment before running this.");
  process.exit(1);
}

// Reads real emails from loadtest/emails.txt if you provide one (one per
// line - e.g. your actual 1,500-student list), otherwise generates
// synthetic ones matching your domain for a pure load test.
function loadEmails(): string[] {
  const file = path.join(__dirname, "emails.txt");
  if (fs.existsSync(file)) {
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return Array.from({ length: NUM_TOKENS }, (_, i) => `loadtest.user${i + 1}@${EMAIL_DOMAIN}`);
}

async function main() {
  const emails = loadEmails();
  console.log(`Generating ${emails.length} session tokens...`);

  const tokens = [];
  for (const email of emails) {
    const jwt = await encode({
      token: { email, name: email.split("@")[0], sub: email },
      secret: SECRET!,
      maxAge: 60 * 60 * 6, // 6 hours - plenty for a test run
    });
    tokens.push({ email, cookie: `${COOKIE_NAME}=${jwt}` });
  }

  const outPath = path.join(__dirname, "tokens.json");
  fs.writeFileSync(outPath, JSON.stringify(tokens, null, 2));
  console.log(`Wrote ${tokens.length} tokens to ${outPath}`);
  console.log("Remember: these emails must already be on the Allowlist for /api/vote to accept them.");
}

main();
