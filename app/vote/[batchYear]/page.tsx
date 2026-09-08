"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "../../topbar";

type Candidate = { id: number; name: string; imageUrl?: string | null };
type CategoryData = {
  id: number;
  name: string;
  gender: string;
  voted: boolean;
  votedCandidateId: number | null;
  candidates: Candidate[];
};
type Batch = { batchYear: number; categories: CategoryData[] };

export default function BatchVotePage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const batchYear = Number(params.batchYear);

  const [votingOpen, setVotingOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [justVoted, setJustVoted] = useState<{ categoryName: string; candidateName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/my-votes");
    if (res.ok) {
      const data = await res.json();
      setVotingOpen(data.votingOpen);
      setRegistered(data.registered);
      setBatches(data.batches);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  if (status === "loading" || (session && !loaded)) {
    return (<><Topbar /><div className="page"><p>Loading...</p></div></>);
  }
  if (!session) {
    return (
      <>
        <Topbar />
        <div className="page">
          <h1>Sign in to continue</h1>
          <button className="btn btn-primary btn-block" onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      </>
    );
  }
  if (!registered || !votingOpen) {
    return (
      <>
        <Topbar />
        <div className="page">
          <button className="back-link" onClick={() => router.push("/vote")}>← Back to batches</button>
          <div className="status-banner blocked">
            <span className="icon">✋</span>
            <p>{!registered ? "You're not on the eligible voters list." : "Voting isn't open right now."}</p>
          </div>
        </div>
      </>
    );
  }

  const batch = batches.find((b) => b.batchYear === batchYear);
  if (!batch) {
    return (
      <>
        <Topbar />
        <div className="page">
          <button className="back-link" onClick={() => router.push("/vote")}>← Back to batches</button>
          <p>Batch not found.</p>
        </div>
      </>
    );
  }

  const totalAll = batches.reduce((sum, b) => sum + b.categories.length, 0);
  const votedAll = batches.reduce((sum, b) => sum + b.categories.filter((c) => c.voted).length, 0);
  const votedInBatch = batch.categories.filter((c) => c.voted).length;
  const batchComplete = votedInBatch === batch.categories.length;

  async function submitVote(category: CategoryData, candidate: Candidate) {
    setError(null);
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: category.id, candidateId: candidate.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setJustVoted({ categoryName: category.name, candidateName: candidate.name });
      await load();
    } else {
      setError(data.error ?? "Something went wrong.");
    }
  }

  if (justVoted) {
    return (
      <>
        <Topbar />
        <div className="page success-screen">
          <div className="success-ring">✓</div>
          <div className="success-title">Vote Recorded!</div>
          <p style={{ marginBottom: 24 }}>Your vote has been successfully submitted for {justVoted.categoryName}.</p>
          <button className="btn btn-primary" onClick={() => setJustVoted(null)}>Continue to Next Category</button>

          <div className="card" style={{ marginTop: 28, textAlign: "left" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13 }}>Your Progress</span>
              <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{votedAll}/{totalAll}</span>
            </div>
            <div className="progress-track" style={{ width: "100%", marginTop: 6 }}>
              <div className="progress-fill" style={{ width: `${totalAll ? (votedAll / totalAll) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, textAlign: "left" }}>
            <p style={{ fontSize: 12, marginBottom: 6 }}>Recent Vote</p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13 }}>{justVoted.categoryName}</span>
              <strong style={{ fontSize: 13 }}>{justVoted.candidateName}</strong>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar />
      <div className="page">
        <button className="back-link" onClick={() => router.push("/vote")}>← Back to batches</button>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Batch {batchYear}{batchComplete && <span className="badge badge-green" style={{ marginLeft: 10, verticalAlign: "middle" }}>✓ Completed</span>}</h1>
          </div>
          <span className="badge badge-gray">{votedInBatch}/{batch.categories.length} completed</span>
        </div>

        {error && <div className="toast">{error}</div>}

        {batch.categories.map((cat) => (
          <div key={cat.id} className="category-section">
            <div className="category-section-header">
              <span className="category-section-title">{cat.name}</span>
              {cat.voted ? (
                <span className="badge badge-green">✓ Voted</span>
              ) : (
                <span className="badge badge-gray">Not voted</span>
              )}
            </div>

            {cat.voted ? (
              (() => {
                const picked = cat.candidates.find((c) => c.id === cat.votedCandidateId);
                if (!picked) return null;
                return (
                  <div className="vote-card picked" style={{ maxWidth: 160 }}>
                    <div className="vote-photo">
                      {picked.imageUrl ? <img src={picked.imageUrl} alt={picked.name} /> : null}
                    </div>
                    <span className="vote-name">{picked.name}</span>
                    <span className="badge badge-green">✓ Voted</span>
                  </div>
                );
              })()
            ) : (
              <>
                <p className="category-section-sub">Select one candidate (click to vote)</p>
                <div className="vote-grid">
                  {cat.candidates.length === 0 && <p style={{ fontSize: 13 }}>No candidates added yet.</p>}
                  {cat.candidates.map((cand) => (
                    <div key={cand.id} className="vote-card">
                      <div className="vote-photo">
                        {cand.imageUrl ? <img src={cand.imageUrl} alt={cand.name} /> : null}
                      </div>
                      <span className="vote-name">{cand.name}</span>
                      <button className="vote-btn" onClick={() => submitVote(cat, cand)}>VOTE</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}

        {batchComplete && (
          <div className="status-banner live">
            <span className="icon">🎉</span>
            <p>
              You have completed voting for Batch {batchYear}.{" "}
              <Link href="/vote" className="link">Move to another batch or return to all batches.</Link>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
