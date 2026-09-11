import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const tokens = new SharedArray("tokens", () =>
  JSON.parse(open("./tokens.json"))
);

export const options = {
  scenarios: {
    test: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 2,
      maxDuration: "3m",
    },
  },

  thresholds: {
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  const studentIndex = (__VU - 1) * 2 + __ITER;
  const token = tokens[studentIndex];

  sleep(Math.floor(Math.random() * 3) + 1);

  const res = http.post(
    `${BASE_URL}/api/vote`,
    JSON.stringify({
      categoryId: 17,
      candidateId: 30,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: token.cookie,
      },
      timeout: "30s",
    }
  );

  check(res, {
    "200 or 409": (r) => r.status === 200 || r.status === 409,
    "not 5xx": (r) => r.status < 500,
  });
}
