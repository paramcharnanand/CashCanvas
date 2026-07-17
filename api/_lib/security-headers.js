/**
 * Security headers for the local Express dev server, built on Helmet.
 *
 * Production (Vercel) sets the equivalent headers declaratively in
 * vercel.json, since Vercel's header config is static JSON and can't import
 * this module — the two must be kept in sync by hand (vercel.json has a
 * comment pointing back here). See docs/backend/authentication.md for the
 * CSP rationale, in particular why style-src needs 'unsafe-inline' given
 * the frontend's current inline-style architecture.
 */
import helmet from "helmet";

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc:  ["'self'", "https://www.google.com", "https://www.gstatic.com", "https://cdnjs.cloudflare.com"],
  // 'unsafe-inline' is required until the frontend moves off inline style={{}}
  // attributes (366+ of them today) onto a real stylesheet/design system.
  styleSrc:   ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
  fontSrc:    ["'self'", "https://fonts.gstatic.com"],
  imgSrc:     ["'self'", "data:"],
  connectSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
  frameSrc:   ["https://www.google.com"],
  objectSrc:  ["'none'"],
  baseUri:    ["'self'"],
  formAction: ["'self'"],
  // Matches the X-Frame-Options: DENY below — CSP frame-ancestors takes
  // precedence in modern browsers, so both must say "cannot be framed at all".
  frameAncestors: ["'none'"],
};

/** The same directive list, as the header string vercel.json's CSP entry must mirror. */
export const CONTENT_SECURITY_POLICY = Object.entries(CSP_DIRECTIVES)
  .map(([key, values]) => {
    const kebab = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    return `${kebab} ${values.join(" ")}`;
  })
  .join("; ");

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    // Helmet merges `directives` with its own default directive set unless
    // told otherwise, which was silently adding `upgrade-insecure-requests`
    // — a directive vercel.json's CSP has never included and that this dev
    // server has no business sending either (see the `hsts` note below for
    // why sending it over plain HTTP actively broke WebKit). Explicitly
    // unsetting it here keeps this CSP an exact match for CONTENT_SECURITY_POLICY /
    // vercel.json instead of silently drifting from it.
    directives: { ...CSP_DIRECTIVES, upgradeInsecureRequests: null },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" }, // Helmet defaults to SAMEORIGIN — we need DENY to match vercel.json
  // Helmet sends this unconditionally by default, regardless of whether the
  // connection is actually HTTPS. Set manually below, gated on req.secure,
  // instead.
  hsts: false,
});

/** Express middleware: Helmet's modern defaults plus our CSP, plus the one legacy header Helmet no longer sets. */
export function securityHeaders(req, res, next) {
  helmetMiddleware(req, res, () => {
    // Obsolete in modern browsers but kept for parity with vercel.json / older clients.
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // Strict-Transport-Security tells a browser "only ever use HTTPS for
    // this origin from now on" — sending it over a plain HTTP connection is
    // nonsensical, and per RFC 6797 §8.1 browsers are supposed to ignore it
    // in that case. WebKit doesn't reliably: it was observed upgrading a
    // subresource request to HTTPS anyway on a plain-HTTP page, which then
    // failed outright since nothing here speaks TLS — blanking the app for
    // any WebKit-based session (Safari, Playwright's webkit/mobile-safari
    // projects). `server.js` and the Playwright e2e server both run this
    // middleware over plain HTTP; production (Vercel, genuinely HTTPS) sets
    // its own copy of this header declaratively in vercel.json, unaffected
    // by this. Only send it here when the connection is genuinely secure.
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}
