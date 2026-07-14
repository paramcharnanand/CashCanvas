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
  contentSecurityPolicy: { directives: CSP_DIRECTIVES },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" }, // Helmet defaults to SAMEORIGIN — we need DENY to match vercel.json
});

/** Express middleware: Helmet's modern defaults plus our CSP, plus the one legacy header Helmet no longer sets. */
export function securityHeaders(req, res, next) {
  helmetMiddleware(req, res, () => {
    // Obsolete in modern browsers but kept for parity with vercel.json / older clients.
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });
}
