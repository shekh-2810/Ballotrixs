"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import Topbar from "./topbar";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="eyebrow">Ballotrixs · VIT Bhopal</div>
        <h1 className="hero-title">Mister &amp; Miss<br /><span className="gold">of every batch.</span></h1>
        <p className="subtitle">Vote for your favourites across the 2023–2026 batches. Takes two minutes, one Google sign-in.</p>

        {status === "loading" && <p>Loading...</p>}

        {status !== "loading" && !session && (
          <button className="btn btn-primary btn-block" onClick={() => signIn("google")}>
            Sign in with your college Google account
          </button>
        )}

        {session && (
          <div className="row" style={{ marginTop: 16 }}>
            <Link href="/vote" className="btn btn-primary">Go to Voting →</Link>
            {(session as any).isAdmin && (
              <Link href="/admin" className="btn">Admin Panel</Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
