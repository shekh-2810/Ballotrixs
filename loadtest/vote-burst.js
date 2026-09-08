// Simulates a burst of real, authenticated students voting at once.
// Each virtual user gets its own token (its own "student"), so this
// tests the actual thing that matters: many different students hitting
// /api/vote in the same window, and the UNIQUE(studentEmail, categoryId)
// safeguard holding up under that concurrency.
//
// Usage:
//   BASE_URL=https://your-staging-url.vercel.app k6 run loadtest/vote-burst.js
//
// Requires loadtest/tokens.json (run generate-test-tokens.ts first).

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// A category/candidate id pair that actually exists in lib/candidates.ts -
// override with real ids via env vars if you change the static config.
const CATEGORY_ID = Number(__ENV.CATEGORY_ID || 1);
const CANDIDATE_ID = Number(__ENV.CANDIDATE_ID || 101);

const tokens = new SharedArray("tokens", function () {
  return JSON.parse(open("./tokens.json"));
});

export const options = {
  scenarios: {
    vote_burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 200 },   // students start arriving
        { duration: "30s", target: 1500 },  // sharp spike - everyone votes at once
        { duration: "20s", target: 0 },     // tail off
      ],
    },
  },
  thresholds: {
    // Fails the run if things get too slow or too many unexpected errors happen.
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  // Each VU iteration picks a token by its own unique VU id, so the same
  // "student" doesn't accidentally vote twice across iterations - a real
  // duplicate-vote attempt would be a false failure signal here, since
  // your app is SUPPOSED to reject that with 409, not a bug.
  const token = tokens[(__VU - 1) % tokens.length];

  const res = http.post(
    `${BASE_URL}/api/vote`,
    JSON.stringify({ categoryId: CATEGORY_ID, candidateId: CANDIDATE_ID }),
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: token.cookie,
      },
    }
  );

  check(res, {
    "status is 200 (voted) or 409 (already voted) or 403 (not eligible)": (r) =>
      [200, 409, 403].includes(r.status),
    "not a server error": (r) => r.status < 500,
  });

  sleep(1);
}
