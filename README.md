# VIT Bhopal Student Poll

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

The allowlist is managed by an administrator.

Students do not self-register.

The allowlist is the source of truth for determining whether an authenticated student is eligible to vote.

## Voting

Voting is controlled by an administrator.

When voting is closed:

- Students cannot submit votes.
- Existing voting data remains stored.
- Administrators can still manage and inspect the poll.

When voting is open, an authenticated student must also be present on the allowlist before submitting a vote.

The database enforces the one-vote-per-student-per-category rule with a unique constraint.

## Candidate Management

Administrators can:

- Add candidates
- Upload candidate images
- Remove candidates when permitted

Candidate limits are enforced server-side.

Candidates with existing votes cannot be deleted, preventing accidental destruction of voting data.

## Results

Results are available only to administrators.

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
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
ALLOWED_DOMAIN="vitbhopal.ac.in"
ADMIN_EMAILS="admin@vitbhopal.ac.in"
```

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
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ALLOWED_DOMAIN
ADMIN_EMAILS
```

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
- Protection against deleting candidates with existing votes
- Voting-state checks on vote submission

Client-side validation is treated as convenience only; important authorization and voting rules are enforced on the server.

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
