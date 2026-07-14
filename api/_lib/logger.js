/**
 * Structured logging, shared by every route handler.
 *
 * Production emits one JSON line per event (parseable by any log
 * aggregator); development emits the human-readable `[tag] message` lines
 * routes used before this module existed. Checked at call time (not import
 * time), matching the pattern in lib/mailer.js, so NODE_ENV set after import
 * (Vercel, --env-file) is always respected.
 *
 * Callers are responsible for never passing secrets (passwords, tokens,
 * OTPs, cookies) as `message`/`meta` — this module only controls format, not
 * redaction. See docs/security/threat-model.md.
 */
function isProd() {
  return process.env.NODE_ENV === "production";
}

function emit(level, tag, message, meta) {
  const text = message instanceof Error ? message.message : message;

  if (isProd()) {
    console[level](JSON.stringify({
      level,
      tag,
      message: text,
      ...(meta && Object.keys(meta).length ? meta : {}),
      time: new Date().toISOString(),
    }));
  } else {
    console[level](`[${tag}]`, text, meta && Object.keys(meta).length ? meta : "");
  }
}

export const logger = {
  info:  (tag, message, meta) => emit("log", tag, message, meta),
  warn:  (tag, message, meta) => emit("warn", tag, message, meta),
  error: (tag, message, meta) => emit("error", tag, message, meta),
};
