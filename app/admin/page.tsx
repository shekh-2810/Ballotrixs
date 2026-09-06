"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Topbar from "../topbar";
import { fileToCompressedDataUrl } from "@/lib/image";

type Candidate = { id: number; name: string; imageUrl?: string | null };
type CategoryWithCandidates = { id: number; name: string; candidates: Candidate[] };
type ResultCandidate = { id: number; name: string; imageUrl?: string | null; votes: number; isWinner: boolean };
type ResultRow = { category: string; totalVotes: number; candidates: ResultCandidate[] };

type Tab = "data" | "candidates" | "results";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("data");

  const [votingOpen, setVotingOpen] = useState(false);
  const [allowlistCount, setAllowlistCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [toggling, setToggling] = useState(false);

  // Data tab state
  const [rawText, setRawText] = useState("");
  const [sheetHeaders, setSheetHeaders] = useState<string[] | null>(null);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [emailColumn, setEmailColumn] = useState<number>(0);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Candidates tab state
  const [categories, setCategories] = useState<CategoryWithCandidates[]>([]);
  const [newCandidate, setNewCandidate] = useState<Record<number, { name: string; imageUrl: string }>>({});
  const [dragOverCategory, setDragOverCategory] = useState<number | null>(null);

  // Results tab state
  const [results, setResults] = useState<ResultRow[]>([]);

  async function loadStatus() {
    const res = await fetch("/api/admin/phase");
    if (res.ok) {
      const data = await res.json();
      setVotingOpen(data.votingOpen);
      setAllowlistCount(data.allowlistCount);
      setVoteCount(data.voteCount);
    }
  }
  async function loadResults() {
    const res = await fetch("/api/results");
    if (res.ok) setResults((await res.json()).results);
  }
  async function loadCandidates() {
    const res = await fetch("/api/admin/candidates");
    if (res.ok) setCategories((await res.json()).categories);
  }

  useEffect(() => {
    if ((session as any)?.isAdmin) {
      loadStatus();
      loadResults();
      loadCandidates();
    }
  }, [session]);

  if (status === "loading") return (<><Topbar /><div className="page"><p>Loading...</p></div></>);
  if (!session) {
    return (
      <>
        <Topbar />
        <div className="page">
          <button className="btn btn-primary" onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      </>
    );
  }
  if (!(session as any).isAdmin) {
    return (<><Topbar /><div className="page"><p>You are not an admin.</p></div></>);
  }

  async function toggleVoting() {
    setToggling(true);
    await fetch("/api/admin/phase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votingOpen: !votingOpen }),
    });
    await loadStatus();
    setToggling(false);
  }

  // ---- Data tab: parse either a plain email list or a CSV with a header row ----
  function parseText(text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setSheetHeaders(null);
      setSheetRows([]);
      return;
    }
    const firstFields = lines[0].split(",").map((f) => f.trim());
    const looksLikeHeaderRow = firstFields.length > 1 && !firstFields[0].includes("@");

    if (!looksLikeHeaderRow) {
      // Plain list - one email per line (or comma separated), no columns to pick.
      setSheetHeaders(null);
      setSheetRows([]);
      return;
    }

    const guessedIndex = firstFields.findIndex((h) => h.toLowerCase().includes("email"));
    setSheetHeaders(firstFields);
    setSheetRows(lines.slice(1).map((l) => l.split(",").map((f) => f.trim())));
    setEmailColumn(guessedIndex >= 0 ? guessedIndex : 0);
  }

  function handleRawTextChange(text: string) {
    setRawText(text);
    parseText(text);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRawText(text);
      parseText(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadEmails(emails: string[]) {
    setUploadMsg(null);
    const res = await fetch("/api/admin/allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    const data = await res.json();
    if (res.ok) {
      setUploadMsg(`Added ${data.added} new · skipped ${data.skippedWrongDomain} wrong-domain · ${data.receivedTotal} received total.`);
      setRawText("");
      setSheetHeaders(null);
      setSheetRows([]);
      loadStatus();
    } else {
      setUploadMsg(data.error ?? "Upload failed.");
    }
  }

  function uploadPlainList() {
    const emails = rawText.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
    uploadEmails(emails);
  }

  function uploadFromSheet() {
    const emails = sheetRows.map((row) => row[emailColumn]).filter(Boolean);
    uploadEmails(emails);
  }

  // ---- Candidates tab ----
  async function addCandidate(categoryId: number, imageUrlOverride?: string) {
    const draft = newCandidate[categoryId];
    const name = draft?.name?.trim();

    if (!name) return;

    const res = await fetch("/api/admin/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        name,
        imageUrl:
          imageUrlOverride ??
          (draft?.imageUrl?.trim() || undefined),
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setUploadMsg(data?.error ?? "Could not add candidate.");
      return;
    }

    setUploadMsg(null);

    setNewCandidate((prev) => ({
      ...prev,
      [categoryId]: {
        name: "",
        imageUrl: "",
      },
    }));

    await loadCandidates();
  }

  async function removeCandidate(id: number) {
    const res = await fetch("/api/admin/candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setUploadMsg(data?.error ?? "Could not remove candidate.");
      return;
    }

    setUploadMsg(null);

    await loadCandidates();
    await loadResults();
  }

  async function handleImageDrop(categoryId: number, file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadMsg("Please select an image file.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setUploadMsg("Image must be 5 MB or smaller.");
      return;
    }

    const dataUrl = await fileToCompressedDataUrl(file).catch(() => null);

    if (!dataUrl) {
      setUploadMsg("Could not process that image.");
      return;
    }

    setUploadMsg(null);

    setNewCandidate((prev) => ({
      ...prev,
      [categoryId]: {
        name: prev[categoryId]?.name ?? "",
        imageUrl: dataUrl,
      },
    }));
  }

  return (
    <>
      <Topbar />
      <div className="page">
        <div className="eyebrow">Admin</div>
        <h1>Control Room</h1>
        <p className="subtitle">Manage voters, candidates, and watch results come in.</p>

        <div className="stat-row">
          <div className="stat"><div className="num">{allowlistCount}</div><div className="label">Eligible voters</div></div>
          <div className="stat"><div className="num">{voteCount}</div><div className="label">Votes cast</div></div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Voting</span>
            <span className={`badge ${votingOpen ? "badge-green" : "badge-red"}`}>
              {votingOpen ? "● Live" : "● Closed"}
            </span>
          </div>
          <button
            className={`btn btn-block ${votingOpen ? "btn-red" : "btn-green"}`}
            style={{ marginTop: 10 }}
            onClick={toggleVoting}
            disabled={toggling}
          >
            {toggling ? "Updating..." : votingOpen ? "Stop Voting" : "Start Voting"}
          </button>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "data" ? "active" : ""}`} onClick={() => setTab("data")}>Voter Data</button>
          <button className={`tab ${tab === "candidates" ? "active" : ""}`} onClick={() => setTab("candidates")}>Candidates</button>
          <button className={`tab ${tab === "results" ? "active" : ""}`} onClick={() => setTab("results")}>Results</button>
        </div>

        {tab === "data" && (
          <div>
            <p>Paste a plain list of emails, or paste/upload a CSV with a header row — you'll get to pick which column is the email.</p>
            <textarea
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
              placeholder={"john.21bcs1234@vitbhopal.ac.in\njane.21bcs5678@vitbhopal.ac.in\n\n— or paste a CSV with headers like —\nName,RegNo,Email\nJohn,21BCS1234,john.21bcs1234@vitbhopal.ac.in"}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => fileInputRef.current?.click()}>Upload .csv / .txt file</button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileChange} />
            </div>

            {sheetHeaders ? (
              <div className="card" style={{ marginTop: 16 }}>
                <p style={{ marginBottom: 10 }}>Detected a sheet with columns. Which one is the email field?</p>
                <select
                  className="field"
                  value={emailColumn}
                  onChange={(e) => setEmailColumn(Number(e.target.value))}
                >
                  {sheetHeaders.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
                <p style={{ marginTop: 10, fontSize: 12 }}>
                  {sheetRows.length} rows detected. Preview: {sheetRows.slice(0, 3).map((r) => r[emailColumn]).join(", ") || "—"}
                </p>
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={uploadFromSheet}>
                  Extract &amp; upload this column
                </button>
              </div>
            ) : (
              rawText.trim() && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={uploadPlainList}>
                  Upload pasted emails
                </button>
              )
            )}

            {uploadMsg && <div className="toast" style={{ marginTop: 14 }}>{uploadMsg}</div>}
          </div>
        )}

        {tab === "candidates" && (
          <div>
            <p>Up to 4 per category. Drag a photo onto a slot, or paste an image URL instead — both work.</p>
            {categories.map((cat) => (
              <div key={cat.id} className="card">
                <div className="card-header">
                  <span className="card-title">{cat.name}</span>
                  <span className="badge badge-gold">{cat.candidates.length} / 4</span>
                </div>

                <div className="candidate-grid">
                  {cat.candidates.map((cand) => (
                    <div key={cand.id} className="candidate-card dashed">
                      <div className="candidate-photo">
                        {cand.imageUrl ? (
                          <img src={cand.imageUrl} alt={cand.name} />
                        ) : (
                          <span className="candidate-photo-fallback">{cand.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="candidate-name">{cand.name}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeCandidate(cand.id)}>Remove</button>
                    </div>
                  ))}

                  {cat.candidates.length < 4 && (
                    <div
                      className={`candidate-card dashed ${dragOverCategory === cat.id ? "drag-over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCategory(cat.id); }}
                      onDragLeave={() => setDragOverCategory(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCategory(null);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleImageDrop(cat.id, file);
                      }}
                    >
                      <label className="dropzone" style={{ width: "100%", padding: 0, border: "none" }}>
                        <div className="candidate-photo">
                          {newCandidate[cat.id]?.imageUrl ? (
                            <img src={newCandidate[cat.id].imageUrl} alt="preview" />
                          ) : (
                            <span className="candidate-photo-fallback">+</span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageDrop(cat.id, file);
                          }}
                        />
                      </label>
                      <input
                        placeholder="Name"
                        value={newCandidate[cat.id]?.name ?? ""}
                        onChange={(e) =>
                          setNewCandidate((prev) => ({ ...prev, [cat.id]: { name: e.target.value, imageUrl: prev[cat.id]?.imageUrl ?? "" } }))
                        }
                        style={{ fontSize: 12, padding: 8 }}
                      />
                      <input
                        placeholder="or paste image URL"
                        value={newCandidate[cat.id]?.imageUrl?.startsWith("data:") ? "" : newCandidate[cat.id]?.imageUrl ?? ""}
                        onChange={(e) =>
                          setNewCandidate((prev) => ({ ...prev, [cat.id]: { name: prev[cat.id]?.name ?? "", imageUrl: e.target.value } }))
                        }
                        style={{ fontSize: 12, padding: 8 }}
                      />
                      <button className="btn btn-primary btn-sm" style={{ width: "100%" }} onClick={() => addCandidate(cat.id)}>
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "results" && (
          <div>
            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 4 }}>
              <button className="btn btn-sm" onClick={loadResults}>Refresh</button>
            </div>
            {results.map((r) => (
              <div key={r.category} className="card">
                <div className="card-header">
                  <span className="card-title">{r.category}</span>
                  <span className="badge badge-gray">{r.totalVotes} votes</span>
                </div>
                {r.totalVotes === 0 && <p style={{ fontSize: 13 }}>No votes yet.</p>}
                {r.candidates.map((c) => {
                  const maxVotes = Math.max(1, ...r.candidates.map((x) => x.votes));
                  const isWinner = c.isWinner && c.votes > 0;
                  return (
                    <div key={c.id} style={{ marginTop: 12 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          {isWinner && "👑"} {c.name}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{c.votes}</span>
                      </div>
                      <div className="results-bar-track">
                        <div
                          className={`results-bar-fill ${isWinner ? "winner" : ""}`}
                          style={{ width: `${(c.votes / maxVotes) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
