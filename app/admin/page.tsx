"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "../topbar";

type Student = { email: string; name?: string | null; regNo?: string | null; createdAt: string };
type Candidate = { id: number; name: string; imageUrl?: string | null; _count?: { votes: number } };
type CategoryWithCandidates = { id: number; name: string; batchYear: number; gender: string; candidates: Candidate[] };
type ResultCandidate = { id: number; name: string; imageUrl?: string | null; votes: number; isWinner: boolean };
type ResultRow = { categoryId: number; category: string; batchYear: number; gender: string; totalVotes: number; candidates: ResultCandidate[] };

type Page = "dashboard" | "voters" | "candidates" | "results" | "settings";
type ColumnPick = "email" | "name" | "regNo" | "ignore";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [page, setPage] = useState<Page>("dashboard");

  const [votingOpen, setVotingOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [allowlistCount, setAllowlistCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [loginCount, setLoginCount] = useState(0);
  const [participation, setParticipation] = useState(0);
  const [toggling, setToggling] = useState(false);

  const [rawText, setRawText] = useState("");
  const [sheetHeaders, setSheetHeaders] = useState<string[] | null>(null);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [columnPicks, setColumnPicks] = useState<ColumnPick[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [addForm, setAddForm] = useState({ name: "", regNo: "", email: "" });

  const [categories, setCategories] = useState<CategoryWithCandidates[]>([]);
  const [activeBatchYear, setActiveBatchYear] = useState<number | null>(null);
  const [newCandidate, setNewCandidate] = useState<Record<number, { name: string; imageUrl: string }>>({});
  const [candidateMsg, setCandidateMsg] = useState<string | null>(null);

  const [results, setResults] = useState<ResultRow[]>([]);

  async function loadStatus() {
    const res = await fetch("/api/admin/phase");
    if (res.ok) {
      const data = await res.json();
      setVotingOpen(data.votingOpen);
      setStartedAt(data.startedAt);
      setAllowlistCount(data.allowlistCount);
      setVoteCount(data.voteCount);
      setLoginCount(data.loginCount);
      setParticipation(data.participation ?? 0);
    }
  }
  async function loadResults() {
    const res = await fetch("/api/results");
    if (res.ok) setResults((await res.json()).results);
  }
  async function loadStudents() {
    const res = await fetch("/api/admin/allowlist");
    if (res.ok) setStudents((await res.json()).students);
  }
  async function loadCandidates() {
    const res = await fetch("/api/admin/candidates");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories);
      if (activeBatchYear === null && data.categories.length > 0) {
        setActiveBatchYear(data.categories[0].batchYear);
      }
    }
  }

  useEffect(() => {
    if ((session as any)?.isAdmin) {
      loadStatus();
      loadResults();
      loadStudents();
      loadCandidates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (status === "loading") return <div className="page"><p>Loading...</p></div>;
  if (!session) {
    return (
      <div className="page">
        <button className="btn btn-primary" onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
    );
  }
  if (!(session as any).isAdmin) {
    return <div className="page"><p>You are not an admin.</p></div>;
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

  function guessColumn(headers: string[], keywords: string[]): number {
    return headers.findIndex((h) => keywords.some((k) => h.toLowerCase().includes(k)));
  }

  function parseText(text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setSheetHeaders(null); setSheetRows([]); return; }
    const splitLine = (l: string) => (l.includes("\t") ? l.split("\t") : l.split(",")).map((f) => f.trim());
    const firstFields = splitLine(lines[0]);
    const looksLikeHeaderRow = firstFields.length > 1 && !firstFields.some((f) => f.includes("@"));

    if (!looksLikeHeaderRow) {
      const rows = lines.map((l) => splitLine(l));
      const multiColumn = rows[0].length > 1;
      if (!multiColumn) { setSheetHeaders(null); setSheetRows([]); return; }
      const emailCol = rows[0].findIndex((f) => f.includes("@"));
      const guessedHeaders = rows[0].map((_, i) => (i === emailCol ? "Email" : `Column ${i + 1}`));
      setSheetHeaders(guessedHeaders);
      setSheetRows(rows);
      setColumnPicks(guessedHeaders.map((_, i) => (i === emailCol ? "email" : rows[0][i]?.length <= 4 ? "regNo" : "name")));
      return;
    }

    const rows = lines.slice(1).map((l) => splitLine(l));
    setSheetHeaders(firstFields);
    setSheetRows(rows);
    const emailIdx = guessColumn(firstFields, ["email", "mail"]);
    const nameIdx = guessColumn(firstFields, ["name"]);
    const regIdx = guessColumn(firstFields, ["reg", "roll", "id"]);
    setColumnPicks(firstFields.map((_, i) => (i === emailIdx ? "email" : i === nameIdx ? "name" : i === regIdx ? "regNo" : "ignore")));
  }

  function handleRawTextChange(text: string) { setRawText(text); parseText(text); }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const text = String(reader.result ?? ""); setRawText(text); parseText(text); };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadStudents(list: { email: string; name?: string; regNo?: string }[]) {
    setUploadMsg(null);
    const res = await fetch("/api/admin/allowlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: list }),
    });
    const data = await res.json();
    if (res.ok) {
      setUploadMsg(`Added ${data.added} new · updated ${data.updated} existing · skipped ${data.skippedWrongDomain} wrong-domain.`);
      setRawText(""); setSheetHeaders(null); setSheetRows([]);
      loadStatus(); loadStudents();
    } else {
      setUploadMsg(data.error ?? "Upload failed.");
    }
  }
  function uploadPlainList() {
    const emails = rawText.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
    uploadStudents(emails.map((email) => ({ email })));
  }
  function uploadFromSheet() {
    const emailCol = columnPicks.findIndex((p) => p === "email");
    const nameCol = columnPicks.findIndex((p) => p === "name");
    const regCol = columnPicks.findIndex((p) => p === "regNo");
    if (emailCol === -1) { setUploadMsg("Pick which column is the email field first."); return; }
    const list = sheetRows.map((row) => ({ email: row[emailCol], name: nameCol >= 0 ? row[nameCol] : undefined, regNo: regCol >= 0 ? row[regCol] : undefined })).filter((s) => s.email);
    uploadStudents(list);
  }
  async function addOne() {
    if (!addForm.email.trim()) return;
    await uploadStudents([{ email: addForm.email, name: addForm.name, regNo: addForm.regNo }]);
    setAddForm({ name: "", regNo: "", email: "" });
  }
  async function deleteStudent(email: string) {
    if (!window.confirm(`Remove ${email} from the voter list?`)) return;
    await fetch("/api/admin/allowlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    loadStatus(); loadStudents();
  }

  async function addCandidate(categoryId: number) {
    const draft = newCandidate[categoryId];
    const name = draft?.name?.trim();
    const imagePath = draft?.imageUrl?.trim();
    setCandidateMsg(null);

    if (!name) {
      setCandidateMsg("Enter a candidate name.");
      return;
    }

    const res = await fetch("/api/admin/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, name, imageUrl: imagePath || undefined }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCandidateMsg(data.error ?? "Could not add candidate.");
      return;
    }

    setNewCandidate((prev) => ({ ...prev, [categoryId]: { name: "", imageUrl: "" } }));
    setCandidateMsg("Candidate added.");
    loadCandidates();
  }
  async function removeCandidate(candidate: Candidate) {
    const voteCountForCand = candidate._count?.votes ?? 0;
    const warning = voteCountForCand > 0
      ? `"${candidate.name}" has ${voteCountForCand} vote${voteCountForCand === 1 ? "" : "s"}. Deleting them will permanently remove those votes too. Continue?`
      : `Remove "${candidate.name}"?`;
    if (!window.confirm(warning)) return;
    await fetch("/api/admin/candidates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: candidate.id }) });
    loadCandidates(); loadResults(); loadStatus();
  }
  async function resetCategoryVotes(categoryId: number, categoryName: string) {
    if (!window.confirm(`Reset all votes in "${categoryName}" back to zero? This can't be undone.`)) return;
    await fetch("/api/admin/reset-votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId }) });
    loadResults(); loadStatus();
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.email.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.regNo?.toLowerCase().includes(q));
  }, [students, search]);

  const batchYears = Array.from(new Set(categories.map((c) => c.batchYear))).sort((a, b) => b - a);
  const categoriesForActiveBatch = categories.filter((c) => c.batchYear === activeBatchYear);

  return (
    <>
      <Topbar />
      <div className="admin-shell">
      <div className="admin-sidebar">
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 12, padding: "6px 12px 18px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>
          Admin
        </div>
        <button className={`sidebar-link ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}>📊 Dashboard</button>
        <button className={`sidebar-link ${page === "voters" ? "active" : ""}`} onClick={() => setPage("voters")}>👥 Voters</button>
        <button className={`sidebar-link ${page === "candidates" ? "active" : ""}`} onClick={() => setPage("candidates")}>🧑‍🎓 Candidates</button>
        <button className={`sidebar-link ${page === "results" ? "active" : ""}`} onClick={() => setPage("results")}>📈 Results</button>
        <button className={`sidebar-link ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}>⚙️ Settings</button>
      </div>

      <div className="admin-main">
        {page === "dashboard" && (
          <div>
            <h1>Election Control</h1>
            <p className="subtitle">{votingOpen ? "Voting is currently open." : "Voting is currently closed."}</p>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Election Control</span>
                <span className={`badge ${votingOpen ? "badge-green" : "badge-red"}`}>{votingOpen ? "● LIVE" : "● Closed"}</span>
              </div>
              <button className={`btn btn-block ${votingOpen ? "btn-red" : "btn-green"}`} style={{ marginTop: 10 }} onClick={toggleVoting} disabled={toggling}>
                {toggling ? "Updating..." : votingOpen ? "Stop Voting" : "Start Voting"}
              </button>
              {startedAt && <p style={{ marginTop: 10, fontSize: 12 }}>Started {new Date(startedAt).toLocaleString()}</p>}
            </div>

            <div className="stat-row">
              <div className="stat"><div className="num">{allowlistCount}</div><div className="label">Eligible Voters</div></div>
              <div className="stat"><div className="num">{loginCount}</div><div className="label">Logged In</div></div>
              <div className="stat"><div className="num">{voteCount}</div><div className="label">Votes Cast</div></div>
            </div>

            <div className="card participation-card">
              <div style={{ flex: 1 }}>
                <p style={{ marginBottom: 6 }}>Overall Participation</p>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, participation * 100)}%` }} /></div>
              </div>
              <strong style={{ fontSize: 20, color: "var(--gold)" }}>{(participation * 100).toFixed(1)}%</strong>
            </div>
          </div>
        )}

        {page === "voters" && (
          <div>
            <h1>Voters</h1>
            <p className="subtitle">Upload, search, and manage the eligible voter list.</p>

            <h2 style={{ marginTop: 0 }}>Upload voters</h2>
            <p>Paste a plain list of emails, or paste/upload a sheet with Name, Reg No, and Email columns.</p>
            <textarea value={rawText} onChange={(e) => handleRawTextChange(e.target.value)} placeholder={"john.21bcs1234@vitbhopal.ac.in\tJohn Doe\t21BCS1234"} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => fileInputRef.current?.click()}>Upload .csv / .txt file</button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileChange} />
            </div>

            {sheetHeaders ? (
              <div className="card" style={{ marginTop: 16 }}>
                <p style={{ marginBottom: 10 }}>Detected {sheetHeaders.length} columns and {sheetRows.length} rows. Assign each column:</p>
                <div className="row" style={{ gap: 16 }}>
                  {sheetHeaders.map((h, i) => (
                    <div key={i} style={{ minWidth: 140 }}>
                      <p style={{ fontSize: 12, marginBottom: 4 }}>{h || `Column ${i + 1}`}</p>
                      <select className="field" value={columnPicks[i] ?? "ignore"} onChange={(e) => { const next = [...columnPicks]; next[i] = e.target.value as ColumnPick; setColumnPicks(next); }}>
                        <option value="ignore">Ignore</option>
                        <option value="email">Email</option>
                        <option value="name">Name</option>
                        <option value="regNo">Reg No</option>
                      </select>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={uploadFromSheet}>Upload {sheetRows.length} students</button>
              </div>
            ) : (
              rawText.trim() && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={uploadPlainList}>Upload pasted emails</button>
            )}
            {uploadMsg && <div className="toast" style={{ marginTop: 14 }}>{uploadMsg}</div>}

            <h2>Add one voter</h2>
            <div className="row">
              <input className="field" style={{ flex: 1, minWidth: 140 }} placeholder="Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="field" style={{ flex: 1, minWidth: 120 }} placeholder="Reg No" value={addForm.regNo} onChange={(e) => setAddForm({ ...addForm, regNo: e.target.value })} />
              <input className="field" style={{ flex: 2, minWidth: 200 }} placeholder="Email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
              <button className="btn btn-primary" onClick={addOne}>Add</button>
            </div>

            <h2>Search &amp; manage ({students.length} total)</h2>
            <input className="field" placeholder="Search by name, reg no, or email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
            <div className="card" style={{ padding: 0, maxHeight: 420, overflowY: "auto" }}>
              {filteredStudents.length === 0 && <p style={{ padding: 16, fontSize: 13 }}>No matches.</p>}
              {filteredStudents.map((s) => (
                <div key={s.email} className="row" style={{ justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{s.name || "—"}</strong>
                    <span style={{ color: "var(--text-dim)", marginLeft: 8 }}>{s.regNo || "—"}</span>
                    <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{s.email}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteStudent(s.email)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === "candidates" && (
          <div>
            <h1>Candidates</h1>
            <p className="subtitle">Manage candidates for each batch.</p>

            <div className="tabs">
              {batchYears.map((y) => (
                <button key={y} className={`tab ${activeBatchYear === y ? "active" : ""}`} onClick={() => setActiveBatchYear(y)}>{y}</button>
              ))}
            </div>

            {categoriesForActiveBatch.map((cat) => (
              <div key={cat.id} className="card">
                <div className="card-header">
                  <span className="card-title">{cat.name}</span>
                  <span className="badge badge-gold">{cat.candidates.length} candidates</span>
                </div>
                <div className="vote-grid">
                  {cat.candidates.map((cand) => (
                    <div key={cand.id} className="vote-card">
                      <div className="vote-photo">{cand.imageUrl ? <img src={cand.imageUrl} alt={cand.name} /> : null}</div>
                      <span className="vote-name">{cand.name}</span>
                      {(cand._count?.votes ?? 0) > 0 && <span className="badge badge-gray" style={{ fontSize: 10 }}>{cand._count?.votes} votes</span>}
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => removeCandidate(cand)}>Delete</button>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 14, gap: 8, alignItems: "center" }}>
                  <input
                    className="field"
                    style={{ flex: 1, minWidth: 120 }}
                    placeholder="Candidate name"
                    value={newCandidate[cat.id]?.name ?? ""}
                    onChange={(e) =>
                      setNewCandidate((prev) => ({
                        ...prev,
                        [cat.id]: {
                          name: e.target.value,
                          imageUrl: prev[cat.id]?.imageUrl ?? "",
                        },
                      }))
                    }
                  />
                  <input
                    className="field"
                    style={{ flex: 1, minWidth: 190 }}
                    placeholder="Image file: arjun.jpg"
                    value={newCandidate[cat.id]?.imageUrl ?? ""}
                    onChange={(e) =>
                      setNewCandidate((prev) => ({
                        ...prev,
                        [cat.id]: {
                          name: prev[cat.id]?.name ?? "",
                          imageUrl: e.target.value,
                        },
                      }))
                    }
                  />
                  {newCandidate[cat.id]?.imageUrl && (
                    <div className="vote-photo" style={{ width: 48, height: 48, flexShrink: 0 }}>
                      <img
                        src={
                          newCandidate[cat.id].imageUrl.startsWith("/")
                            ? newCandidate[cat.id].imageUrl
                            : `/candidates/${newCandidate[cat.id].imageUrl}`
                        }
                        alt="Preview"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={() => addCandidate(cat.id)}>+ Add Candidate</button>
                </div>
                <p style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
                  Put the image in <code>public/candidates/</code> first, then enter its filename here. Example: <code>arjun.jpg</code>
                </p>
                {candidateMsg && <p style={{ marginTop: 6, fontSize: 12, color: "var(--gold)" }}>{candidateMsg}</p>}
              </div>
            ))}
          </div>
        )}

        {page === "results" && (
          <div>
            <h1>Results</h1>
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
                        <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>{isWinner && "👑"} {c.name}</span>
                        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{c.votes}</span>
                      </div>
                      <div className="results-bar-track"><div className={`results-bar-fill ${isWinner ? "winner" : ""}`} style={{ width: `${(c.votes / maxVotes) * 100}%` }} /></div>
                    </div>
                  );
                })}
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 14, color: "var(--red)" }} onClick={() => resetCategoryVotes(r.categoryId, r.category)}>Reset votes for this category</button>
              </div>
            ))}
          </div>
        )}

        {page === "settings" && (
          <div>
            <h1>Settings</h1>
            <div className="card">
              <p>Domain restriction: <strong>@{process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? "your-domain"}</strong></p>
              <p style={{ marginTop: 8 }}>Signed in as: <strong>{session.user?.email}</strong></p>
            </div>
            <Link href="/" className="link">← Back to site</Link>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
