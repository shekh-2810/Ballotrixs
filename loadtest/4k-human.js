import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const tokens = new SharedArray("tokens", function () {
  return JSON.parse(open("./tokens.json"));
});

/*
 * Categories currently present in the database.
 *
 * Empty categories are intentionally skipped:
 *   2026 Mister (17) - no candidates
 *   2024 Mister (21) - no candidates
 *   2023 Mister (23) - no candidates
 *   2023 Miss   (24) - no candidates
 */
const VOTING_CATEGORIES = [
  {
    batchYear: 2026,
    gender: "miss",
    categoryId: 18,
    candidates: [67, 69, 82],
  },
  {
    batchYear: 2025,
    gender: "mister",
    categoryId: 19,
    candidates: [72, 73, 75, 76],
  },
  {
    batchYear: 2025,
    gender: "miss",
    categoryId: 20,
    candidates: [70, 71],
  },
  {
    batchYear: 2024,
    gender: "miss",
    categoryId: 22,
    candidates: [78],
  },
];

export const options = {
  scenarios: {
    voters: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 40,
      maxDuration: "30m",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<10000"],
  },
};

export default function () {
  const voterIndex = (__VU - 1) * 40 + __ITER;

  if (voterIndex >= tokens.length) {
    return;
  }

  const token = tokens[voterIndex];

  console.log(
    `Voter ${voterIndex + 1}/${
      tokens.length
    } | ${token.email}`
  );

  for (let i = 0; i < VOTING_CATEGORIES.length; i++) {
    const category = VOTING_CATEGORIES[i];

    // Distribute voters across candidates.
    const candidateId =
      category.candidates[voterIndex % category.candidates.length];

    const payload = JSON.stringify({
      categoryId: category.categoryId,
      candidateId,
    });

    const res = http.post(`${BASE_URL}/api/vote`, payload, {
      headers: {
        "Content-Type": "application/json",
        Cookie: token.cookie,
      },
      tags: {
        endpoint: "vote",
        batch: String(category.batchYear),
        gender: category.gender,
      },
    });

    const ok = check(res, {
      "vote accepted": (r) => r.status === 200,
      "not server error": (r) => r.status < 500,
    });

    if (!ok) {
      console.error(
        `Voter ${voterIndex + 1} | ` +
        `${category.batchYear} ${category.gender} | ` +
        `category=${category.categoryId} | ` +
        `candidate=${candidateId} | ` +
        `status=${res.status} | ` +
        `body=${res.body}`
      );
    }

    // Human-like pause between categories.
    if (i < VOTING_CATEGORIES.length - 1) {
      sleep(Math.random() * 6 + 4);
    }
  }

  // Pause before the next voter handled by this VU.
  sleep(Math.random() * 4 + 2);
}
