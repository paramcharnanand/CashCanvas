/**
 * Builds an Express app for tests, wired identically to server.js (same
 * handler modules, same routes) — minus CORS/listen, which supertest
 * doesn't need.
 */
import express from "express";
import authHandler from "../api/auth.js";
import dataHandler from "../api/data.js";
import aiHandler from "../api/ai.js";
import { securityHeaders } from "../api/lib/security-headers.js";

export function buildTestApp() {
  const app = express();
  app.use(securityHeaders);
  app.use(express.json({ limit: "10mb" }));
  app.all("/api/auth/*", authHandler);
  app.all(
    ["/api/files", "/api/files/*", "/api/categories", "/api/categories/*", "/api/merchant-rules"],
    dataHandler
  );
  app.all(["/api/categorize", "/api/parse-pdf"], aiHandler);
  return app;
}
