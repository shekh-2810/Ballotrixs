import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const VOTES = [
  { categoryId: 17, candidateId: 30 },
  { categoryId: 18, candidateId: 37 },
];

const tokens = new SharedArray("tokens", () =>
  JSON.parse(open("./tokens.json"))
);

export const options = {
  scenarios: {
    four_thousand_votes: {
      executor: "per-vu-iterations",

      // Only 50 voters active at once.
      vus: 50,

      // Each VU handles 40 students.
      // 50 × 40 = 2,000 students.
      iterations: 40,

      maxDuration: "20m",
    },
  },

  thresholds: {
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<10000"],
  },

  // Give requests up to 90 seconds rather than failing early.
};

function delay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function vote(studentIndex, voteData) {
  const token = tokens[studentIndex];

  const res = http.post(
    `${BASE_URL}/api/vote`,
    JSON.stringify({
      categoryId: voteData.categoryId,
      candidateId: voteData.candidateId,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: token.cookie,
      },
      timeout: "90s",
      tags: {
        endpoint: "vote",
        category: String(voteData.categoryId),
      },
    }
  );

  check(res, {
    "application response": (r) =>
      r.status === 200 || r.status === 409,

    "not 5xx": (r) => r.status < 500,
  });

  return res.status;
}

export default function () {
  // Unique student for this VU/iteration.
  const studentIndex = (__VU - 1) * 40 + __ITER;

  if (studentIndex >= 2000) {
    return;
  }

  // Student opens the voting page / thinks before voting.
  sleep(delay(2, 6));

  // Category 1.
  vote(studentIndex, VOTES[0]);

  // Student moves to the next category.
  sleep(delay(5, 15));

  // Category 2.
  vote(studentIndex, VOTES[1]);

  // Student leaves.
  sleep(delay(2, 5));
}
