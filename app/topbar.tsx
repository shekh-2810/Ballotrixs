"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Topbar() {
  const { data: session } = useSession();
  return (
    <div className="topbar">
      <Link href="/" className="brand">🗳️ <span>Ballotrixs</span></Link>
      {session?.user?.email && (
        <div className="row">
          <span className="user">{session.user.email}</span>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
