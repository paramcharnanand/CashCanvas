/**
 * Wrap a route-dispatch function so any error it throws or rejects with is
 * caught, logged server-side only, and turned into a generic JSON response —
 * never a raw stack trace, Mongo error message, or other internal detail
 * reaching the client. Individual route handlers can (and mostly do) still
 * have their own try/catch for expected failure modes; this is the backstop
 * for everything else.
 */
import { logger } from "./logger.js";

export function withErrorHandling(routerFn) {
  return async function wrapped(req, res) {
    try {
      await routerFn(req, res);
    } catch (err) {
      logger.error("unhandled", err, { method: req.method, url: req.url });
      if (!res.headersSent) {
        res.status(500).json({ error: "Something went wrong. Please try again." });
      }
    }
  };
}
