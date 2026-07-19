/**
 * Local development API server.
 *
 * This is a thin Express bootstrap — it owns no business logic. All auth,
 * OTP, data, and AI routes are handled by the exact same modules Vercel
 * invokes in production (api/auth.js, api/data.js, api/ai.js), which in turn
 * share their OTP/JWT/mailer/reCAPTCHA/password logic from api/_lib/*. This
 * guarantees dev and prod can never drift apart the way they used to.
 *
 * Run alongside Vite: `npm run dev:full`
 */
import express from "express";
import cors from "cors";
import authHandler from "./api/auth.js";
import dataHandler from "./api/data.js";
import aiHandler from "./api/ai.js";
import { securityHeaders } from "./api/_lib/security-headers.js";

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Lock down to known local origins. In production, Vercel serves everything
// on the same domain so CORS isn't an issue there. `credentials: true` is
// required so the browser sends/accepts our auth cookies cross-port in dev
// (Vite proxies /api to this server, but XHR/fetch still needs this set).
const DEV_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",").map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || DEV_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error("CORS: origin not allowed"));
  },
  credentials: true,
}));

// ── Security headers ─────────────────────────────────────────────────────────
// Helmet + CSP. See api/_lib/security-headers.js — vercel.json mirrors this
// in production with a static (non-Helmet) header config of its own.
app.use(securityHeaders);

app.use(express.json({ limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
// Each handler does its own internal method/path routing (and, for auth/AI
// routes, its own rate limiting) — see the imported modules.
app.all("/api/auth/*", authHandler);
app.all(
  ["/api/files", "/api/files/*", "/api/categories", "/api/categories/*", "/api/merchant-rules", "/api/merchant-rules/*", "/api/savings"],
  dataHandler
);
app.all(["/api/categorize", "/api/parse-pdf"], aiHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`);
});
