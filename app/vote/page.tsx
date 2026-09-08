"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "../topbar";

type Batch = { batchYear: number; categories: { id: number; voted: boolean }[] };

export default function BatchSelectionPage() {
  const { data: session, status } = useSession();
  const [votingOpen, setVotingOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const wasOpenRef = useRef<boolean | null>(null);

  async function loadFull() {
    const res = await fetch("/api/my-votes");
    if (res.ok) {
      const data = await res.json();
      setVotingOpen(data.votingOpen);
      setRegistered(data.registered);
      setBatches(data.batches);
      wasOpenRef.current = data.votingOpen;
    }
    setLoaded(true);
  }

  async function pollStatus() {
    const res = await fetch("/api/poll-status");
    if (!res.ok) return;
    const data = await res.json();
    setRegistered(data.registered);
    if (wasOpenRef.current === false && data.votingOpen === true) {
      loadFull();
    } else {
      setVotingOpen(data.votingOpen);
    }
    wasOpenRef.current = data.votingOpen;
  }

  useEffect(() => {
    if (session) loadFull();
    const interval = setInterval(() => {
      if (session) pollStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [session]);

  if (status === "loading" || (session && !loaded)) {
    return (<><Topbar /><div className="page"><p>Loading...</p></div></>);
  }

  if (!session) {
    return (
      <>
        <Topbar />
        <div className="page">
          <div className="eyebrow">Cast your vote</div>
          <h1>Sign in to continue</h1>
          <button className="btn btn-primary btn-block" onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      </>
    );
  }

  if (!registered) {
    return (
      <>
        <Topbar />
        <div className="page">
          <div className="eyebrow">Cast your vote</div>
          <h1>Not on the list</h1>
          <div className="status-banner blocked">
            <span className="icon">✋</span>
            <p>This email isn't on the eligible voters list. If that seems wrong, reach out to the poll admin.</p>
          </div>
        </div>
      </>
    );
  }

  if (!votingOpen) {
    return (
      <>
        <Topbar />
        <div className="page" style={{ textAlign: "center", paddingTop: 40 }}>
          <div className="success-ring" style={{ borderColor: "var(--gold)", color: "var(--gold)", boxShadow: "0 0 40px rgba(212,163,79,0.2)" }}>⏳</div>
          <h1>Voting is not live yet</h1>
          <p style={{ maxWidth: 340, margin: "0 auto 20px" }}>The election has not started. Please wait for the administrator to open voting.</p>
          <div className="status-banner waiting" style={{ textAlign: "left" }}>
            <span className="icon">🟡</span>
            <p>Waiting for election to start — this page will automatically update when voting begins.</p>
          </div>
        </div>
      </>
    );
  }

  const totalCategories = batches.reduce((sum, b) => sum + b.categories.length, 0);
  const votedTotal = batches.reduce((sum, b) => sum + b.categories.filter((c) => c.voted).length, 0);

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Student Elections</h1>
            <p className="subtitle">Choose your batch</p>
          </div>
          <div className="overall-progress-badge">
            <span className="badge badge-gray">Overall Progress {votedTotal}/{totalCategories}</span>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${totalCategories ? (votedTotal / totalCategories) * 100 : 0}%` }} /></div>
          </div>
        </div>

        <div className="batch-grid">
          {batches.map((b) => {
            const votedCount = b.categories.filter((c) => c.voted).length;
            const done = votedCount === b.categories.length && b.categories.length > 0;
            return (
              <Link key={b.batchYear} href={`/vote/${b.batchYear}`} className={`batch-card ${done ? "done" : ""}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div className="batch-label">Batch</div>
                <div className="batch-year">{b.batchYear}</div>
                <div className="batch-sub">Mister • Miss</div>
                <div className="batch-card-footer">
                  <span className="batch-progress-pill">{votedCount}/{b.categories.length} voted</span>
                  <span className="batch-arrow">→</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="status-banner" style={{ marginTop: 22 }}>
          <span className="icon">ℹ️</span>
          <p>Your votes are recorded immediately. If voting closes while you are still completing your ballot, your submitted votes remain saved.</p>
        </div>
      </div>
    </>
  );
}
