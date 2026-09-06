"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Topbar from "../topbar";

type Candidate = { id: number; name: string; imageUrl?: string | null };
type Category = { id: number; name: string; candidates: Candidate[]; voted: boolean };

export default function VotePage() {
  const { data: session, status } = useSession();
  const [votingOpen, setVotingOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [justWentLive, setJustWentLive] = useState(false);
  const wasOpenRef = useRef<boolean | null>(null);

  async function load() {
    const res = await fetch("/api/my-votes");
    if (res.ok) {
      const data = await res.json();
      if (wasOpenRef.current === false && data.votingOpen === true) {
        setJustWentLive(true);
        setTimeout(() => setJustWentLive(false), 4000);
      }
      wasOpenRef.current = data.votingOpen;
      setVotingOpen(data.votingOpen);
      setRegistered(data.registered);
      setCategories(data.categories);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (session) load();
    const interval = setInterval(() => {
      if (session) load();
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
          <p className="subtitle">Use your college Google account to verify you're eligible.</p>
          <button className="btn btn-primary btn-block" onClick={() => signIn("google")}>
            Sign in with Google
          </button>
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
            <p>This email isn't on the eligible voters list. If that seems wrong, reach out to whoever's running the poll.</p>
          </div>
        </div>
      </>
    );
  }

  if (!votingOpen) {
    return (
      <>
        <Topbar />
        <div className="page">
          <div className="eyebrow">Cast your vote</div>
          <h1>You're all set</h1>
          <div className="status-banner waiting">
            <span className="icon">⏳</span>
            <p>Voting hasn't opened yet. Keep this tab open — it'll unlock the moment it starts, no refresh needed.</p>
          </div>
        </div>
      </>
    );
  }

  async function submitVote(categoryId: number, candidateId: number) {
    setMessage(null);
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, candidateId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Vote recorded ✓");
      setOpenCategoryId(null);
      load();
    } else {
      setMessage(data.error ?? "Something went wrong.");
    }
  }

  const votedCount = categories.filter((c) => c.voted).length;
  const allDone = votedCount === categories.length && categories.length > 0;

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="eyebrow">Cast your vote</div>
        <h1>Mister &amp; Miss</h1>
        <p className="subtitle">{votedCount} of {categories.length} categories completed</p>

        {justWentLive && (
          <div className="status-banner live">
            <span className="icon">🎉</span>
            <p>Voting is now open — cast your picks below.</p>
          </div>
        )}
        {allDone && !justWentLive && (
          <div className="status-banner live">
            <span className="icon">✅</span>
            <p>You've voted in every category. Thanks for participating!</p>
          </div>
        )}
        {message && <div className="toast">{message}</div>}

        {categories.map((cat) => (
          <div key={cat.id} className={`card ${cat.voted ? "voted" : ""}`}>
            <div className="card-header">
              <span className="card-title">{cat.name}</span>
              {cat.voted ? (
                <span className="badge badge-green">✓ Voted</span>
              ) : (
                <span className="badge badge-gray">Not voted</span>
              )}
            </div>

            {!cat.voted && openCategoryId !== cat.id && (
              <button className="btn" style={{ marginTop: 8 }} onClick={() => setOpenCategoryId(cat.id)}>
                Vote now
              </button>
            )}

            {!cat.voted && openCategoryId === cat.id && (
              <div className="candidate-grid">
                {cat.candidates.length === 0 && (
                  <p style={{ fontSize: 13 }}>No candidates added for this category yet.</p>
                )}
                {cat.candidates.map((cand) => (
                  <button key={cand.id} className="candidate-card" onClick={() => submitVote(cat.id, cand.id)}>
                    <div className="candidate-photo">
                      {cand.imageUrl ? (
                        <img src={cand.imageUrl} alt={cand.name} />
                      ) : (
                        <span className="candidate-photo-fallback">{cand.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="candidate-name">{cand.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
