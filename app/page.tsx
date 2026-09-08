"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="hero-shell">
      <div className="hero-card">
        <div className="hero-photo">
          <span style={{ fontWeight: 800, letterSpacing: 1, color: "var(--gold)", fontSize: 14 }}>BALLOTRIXS</span>
          <span className="badge badge-gray" style={{ fontSize: 10 }}>VIT BHOPAL</span>
        </div>
        <div className="hero-body">
          <div className="hero-tagline">Student Election Portal</div>
          <h1 className="hero-headline">Your Voice.<br /><span className="gold">Your Choice.</span></h1>
          <p style={{ fontSize: 13 }}>Vote for Mister &amp; Miss across the 2023, 2024, 2025 and 2026 batches.</p>

          {status !== "loading" && !session && (
            <button className="google-btn" onClick={() => signIn("google")}>
              <span style={{ fontWeight: 800, color: "#4285F4" }}>G</span> Continue with Google
            </button>
          )}
          {session && (
            <Link href="/vote" className="btn btn-primary btn-block" style={{ marginTop: 18, display: "block", textAlign: "center" }}>
              Continue to Voting →
            </Link>
          )}
          {session && (session as any).isAdmin && (
            <Link href="/admin" className="link" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 13 }}>
              Admin Panel
            </Link>
          )}
          <p className="hero-note">@vitbhopal.ac.in accounts only</p>
        </div>
        <div className="trust-row">
          <span>🛡️ Secure</span>
          <span>👤 One Student</span>
          <span>🗳️ One Vote</span>
        </div>
      </div>
    </div>
  );
}
