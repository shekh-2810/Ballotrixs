# Ballotrixs

A secure student voting application for VIT Bhopal, built with Next.js, NextAuth, Prisma, and PostgreSQL.

## Features

- Google OAuth authentication
- Server-side college-domain validation
- Admin-managed voter allowlist
- Admin dashboard
- Candidate management
- Maximum 4 candidates per category
- Candidate image upload and client-side compression
- One vote per student per category
- Database-enforced duplicate-vote protection
- Admin-controlled voting open/close switch
- Live voting status
- Admin-only results dashboard
- PostgreSQL database with Prisma ORM
- Production deployment support for Vercel

## Voting Structure

The application currently contains these categories:

- Mister 2026
- Miss 2026
- Mister 2025
- Miss 2025
- Mister 2024
- Miss 2024
- Mister 2023
- Miss 2023

Each category can contain a maximum of four candidates.

A student can cast one vote per category.

## Authentication

Students authenticate through Google OAuth.

Only accounts belonging to the configured college domain are allowed to sign in.

The Google `hd` parameter is used only as a Google Workspace hint. The actual domain restriction is enforced server-side.

Administrators are configured separately through the `ADMIN_EMAILS` environment variable.

## Voter Allowlist

The allowlist is managed by an administrator, from the "Voter Data" tab:

- Bulk upload via pasted or uploaded CSV/sheet (columns are matched by
  you, not guessed silently - the admin panel shows a preview and lets
  you assign each column to Email / Name / Reg No / Ignore).
- Plain email-only lists are also supported (one per line).
- A search box filters the full list by name, reg no, or email.
- Individual students can be added or removed without a full re-upload.
- Re-uploading a sheet updates name/regNo on existing rows rather than
  skipping them as duplicates, so correcting a typo just means
  re-uploading the corrected sheet.

Students do not self-register. The allowlist is the source of truth for
determining whether an authenticated student is eligible to vote.

## Voting

Voting is controlled by an administrator via a single Start/Stop toggle.

When voting is closed:

- Students cannot submit votes.
- Existing voting data remains stored.
- Administrators can still manage and inspect the poll.

When voting is open, an authenticated student must also be present on the allowlist before submitting a vote.

The database enforces the one-vote-per-student-per-category rule with a unique constraint.

## Candidates

Candidates are managed from the admin panel's "Candidates" page, organized
by batch year (2023-2026) with Mister/Miss sections underneath. Each
candidate has a name and an optional image URL (paste a link - Google
Drive "anyone with the link" share, Imgur, etc.). Deleting a candidate
who already has votes is allowed, with a confirmation prompt that shows
how many votes will be removed along with them.

## Batches

Voting is organized around "batches" (graduation years 2023-2026), each
containing a Mister and a Miss category. Students land on a batch
selection screen first, then vote within a batch for both categories -
a completed category shows the student's pick with a checkmark instead
of the candidate grid, and a completed batch shows a congratulatory
banner pointing back to the remaining batches.

## Results

Results are available only to administrators, including a per-category
"Reset votes" action that zeroes out just that category (candidates and
the allowlist are untouched).

The results view provides vote counts for candidates and identifies winners based on the highest vote total.

Ties are represented as multiple winners when candidates have the same highest non-zero vote count.

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- NextAuth.js
- Prisma ORM
- PostgreSQL
- Vercel

## Project Structure

```text
college-poll-app/
├── app/
│   ├── admin/
│   │   └── page.tsx
│   ├── api/
│   │   ├── admin/
│   │   │   ├── allowlist/
│   │   │   ├── candidates/
│   │   │   └── phase/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   ├── my-votes/
│   │   ├── results/
│   │   └── vote/
│   ├── vote/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   └── topbar.tsx
├── lib/
│   ├── auth.ts
│   ├── image.ts
│   └── prisma.ts
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

## Local Development

### Requirements

- Node.js
- npm
- PostgreSQL database
- Google OAuth credentials

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Configure the required environment variables.

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@host-pooler.region.aws.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host.region.aws.neon.tech/dbname?sslmode=require"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
ALLOWED_DOMAIN="vitbhopal.ac.in"
ADMIN_EMAILS="admin@vitbhopal.ac.in"
```

`DATABASE_URL` and `DIRECT_URL` are two different connection strings
from Neon - see `.env.example` for why both are needed (short version:
migrations need the direct one, the running app needs the pooled one).

Never commit the real `.env` file.

### Database

Generate the Prisma client:

```bash
npx prisma generate
```

Apply development migrations:

```bash
npx prisma migrate dev
```

Seed the initial poll configuration and categories:

```bash
npm run seed
```

### Updating from an earlier version

This version adds a `LoginLog` table (tracks distinct students who have
signed in, shown as "Logged in" on the admin dashboard) and changes how
candidate deletion works (deleting a candidate now also removes their
votes, with a confirmation prompt, instead of being blocked). Run:

```bash
npx prisma migrate dev --name login-log-and-candidate-delete
```

against your existing database (locally, and again with
`prisma migrate deploy` against your production/Neon database) to pick
up the schema change. No existing data is lost.

### Updating to static candidates (superseded - see below)

An earlier version of this project briefly moved candidates to a static
code file (`lib/candidates.ts`). That approach has been reverted -
candidates are back in the database with a full admin management UI,
since the design now calls for Add/Delete from the Candidates page. If
you migrated to that static version, skip ahead to the next section.

### Updating to the batch-based redesign (this version)

This version reworks the schema again:

- `Category` gains `batchYear` (Int) and `gender` ("mister"/"miss")
  columns, replacing name-string-parsing with real fields.
- `Candidate` is back (it was briefly removed for the static-candidates
  version) with `imageUrl`.
- `PollConfig` gains `startedAt` (DateTime, nullable) - stamped the
  first time voting is switched on, shown in the admin dashboard.
- The UI is restructured around "batches": `/vote` is now a batch
  picker, and `/vote/[batchYear]` is the actual voting page for one
  batch's two categories.

If you have an existing database with data from the static-candidates
version (no `Category`/`Candidate` tables), or from before that (with
`Category`/`Candidate` tables but no `batchYear`/`gender`/`imageUrl`
columns), the cleanest path for a project still in testing/dry-run is:

```bash
npx prisma migrate reset
npm run seed
```

**This wipes all existing data** (votes, allowlist, candidates) - fine
for a project still being set up and tested (like your 1,500-student
dry run), but do not run this once real voting data exists. For a
database with real data you need to keep, a manual migration path
(preserving Allowlist rows, re-adding candidates through the new admin
UI, and remapping any existing votes) is more involved - ask if you
need to go that route instead.

After migrating, re-upload your voter list and add candidates through
the admin panel's Candidates page (batch tabs → name + image URL →
Add Candidate).

### Start Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

## Production Deployment

The application is designed to run on Vercel with a PostgreSQL database.

### Build

```bash
npm run build
```

### Production Migration

Use:

```bash
npm run prisma:deploy
```

Production deployments should use `prisma migrate deploy` rather than `prisma migrate dev`.

### Database Seeding

The initial categories can be created using:

```bash
npm run seed
```

Run this only against the intended database.

## Vercel Environment Variables

Configure these variables in the Vercel project:

```text
DATABASE_URL
DIRECT_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ALLOWED_DOMAIN
NEXT_PUBLIC_ALLOWED_DOMAIN
ADMIN_EMAILS
```

`DIRECT_URL` isn't used at runtime by the deployed app, only by
`prisma migrate` when you run migrations locally against the production
database - but Vercel's build step also runs `prisma generate`, which
reads the schema (including the `directUrl` reference), so it's safest
to set it in Vercel too rather than relying on it only being present
locally.

`NEXTAUTH_URL` must point to the deployed application URL.

## Google OAuth Configuration

The Google OAuth application must allow the appropriate callback URL.

For a deployment at:

```text
https://your-domain.example
```

the Google OAuth callback URL is:

```text
https://your-domain.example/api/auth/callback/google
```

For local development:

```text
http://localhost:3000/api/auth/callback/google
```

## Security Notes

The application includes several server-side protections:

- College-domain validation during authentication
- Admin authorization on administrative API routes
- Allowlist verification before voting
- Candidate/category relationship validation
- Server-side candidate count limits
- Database-level duplicate-vote protection
- Confirmation prompt before deleting a candidate that has votes (deleting removes those votes - it's allowed, but not silent)
- Voting-state checks on vote submission

Client-side validation is treated as convenience only; important authorization and voting rules are enforced on the server.

## Scaling Notes (Neon free tier + ~3,000 students)

Two of Neon's free-tier meters (100 CU-hours/month, 0.5 GB storage) are
not a real constraint at this scale - a full voting event uses a few
CU-hours and a few MB of storage at most. The two things that actually
matter:

- **Use two connection strings, not one.** `DATABASE_URL` (pooled, for
  the running app) and `DIRECT_URL` (direct, for `prisma migrate` only)
  - see `.env.example`. Vercel's serverless functions each open their
  own database connection; without the pooled URL for runtime, a burst
  of students voting at once can exhaust Postgres's connection limit.
  Using the pooled URL for migrations instead causes a connection error
  (P1001), since migrations need session-level locks PgBouncer's pooled
  mode doesn't support - hence needing both.
- **Don't poll endpoints that return images.** `/api/poll-status` returns
  only booleans/IDs and is safe to call on a timer from every student's
  browser. `/api/my-votes` returns full candidate data including photos
  and should only be fetched once per page load (or right when voting
  turns on) - never on an interval. The current `/vote` page is built
  this way; keep that split if you extend it.

## Analytics

[Vercel Analytics](https://vercel.com/docs/analytics) is wired in via
`<Analytics />` in the root layout. It collects automatically once
deployed on Vercel - enable it for the project in the Vercel dashboard
(Project → Analytics → Enable) to start seeing traffic data. No
additional code changes needed; it's a no-op locally and on other hosts.

## Load Testing

`loadtest/` contains a k6 setup for simulating a real voting burst.
Since voting requires a real Google-authenticated session and k6 can't
click through Google's login screen, `generate-test-tokens.ts` mints
valid NextAuth session tokens directly (signed the same way NextAuth
signs them) for a list of test emails, without a real OAuth flow.

**Only ever run this against a staging environment with its own
database - never production.**

```bash
# 1. Point at your staging environment's secrets
export NEXTAUTH_SECRET="same value as staging's NEXTAUTH_SECRET"
export NEXTAUTH_URL="https://your-staging-url.vercel.app"

# 2. Optional: put real/test emails in loadtest/emails.txt (one per line)
#    - they must already be on that environment's Allowlist.
#    Without this file, synthetic emails are generated instead.

# 3. Generate tokens
npx tsx loadtest/generate-test-tokens.ts

# 4. Run the burst test
BASE_URL="https://your-staging-url.vercel.app" \
CATEGORY_ID=1 CANDIDATE_ID=1 \
k6 run loadtest/vote-burst.js
```

`CATEGORY_ID`/`CANDIDATE_ID` must match real IDs in your staging
database (check via the admin Candidates page or Prisma Studio - the
old placeholder IDs from `lib/candidates.ts` no longer apply now that
candidates are DB-backed again).

The script ramps from 0 to 1,500 virtual users over ~30 seconds, each
with a distinct token/student, all POSTing to `/api/vote`. A `200` or
`409` (already voted) or `403` (not eligible) are all expected/healthy
outcomes - only `5xx` responses or high latency indicate a real
problem. After the run, use the admin Results page's "Reset votes for
this category" button to clear out the test votes before real voting
opens.

## Important Operational Rules

Before opening voting:

1. Configure the production environment variables.
2. Verify Google OAuth configuration.
3. Apply Prisma migrations.
4. Seed the initial categories if required.
5. Upload the approved voter allowlist.
6. Add and verify candidates.
7. Confirm candidate images.
8. Confirm the voting state is closed during setup.
9. Test login and voting with an approved test account.
10. Open voting from the admin dashboard.

After voting begins, avoid modifying candidates that already have votes.

## License

Private project for VIT Bhopal student polling.

## Candidate Images

Candidate photos are static repository assets. Put them under `public/candidates/`
(or a year subfolder such as `public/candidates/2026/`) and commit them to Git.

In the Admin → Candidates screen, enter the filename/path, for example:

`arjun.jpg`

or:

`2026/arjun.jpg`

The database stores only the resulting `/candidates/...` path. Changing an image
requires committing and pushing the replacement file so the deployment is updated.
