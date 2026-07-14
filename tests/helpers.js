import request from "supertest";

export function extractCookie(res, name) {
  const setCookie = res.headers["set-cookie"] || [];
  for (const raw of setCookie) {
    const match = raw.match(new RegExp(`^${name}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export function isCookieCleared(res, name) {
  const setCookie = res.headers["set-cookie"] || [];
  return setCookie.some((c) => c.startsWith(`${name}=`) && /Max-Age=0/.test(c));
}

let userCounter = 0;

export function uniqueEmail() {
  userCounter += 1;
  return `user${userCounter}-${Date.now()}@example.test`;
}

export async function signupUser(app, email, password = "password123") {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/signup").send({ name: "Test User", email, password });
  const csrf = extractCookie(res, "cc_csrf");
  return { agent, csrf, res };
}
