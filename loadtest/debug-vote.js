import http from "k6/http";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const tokens = new SharedArray("tokens", () =>
  JSON.parse(open("./tokens.json"))
);

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const token = tokens[0];

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

  console.log(`STATUS: ${res.status}`);
  console.log(`BODY: ${res.body}`);
  console.log(`COOKIE: ${token.cookie}`);
}
