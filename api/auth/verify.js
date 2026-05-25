/**
 * GET /api/auth/verify?token=<hex>
 *
 * Validates the email-verification token sent in the sign-up email.
 * On success the user's account is activated and a JWT is returned so the
 * frontend can sign the user in immediately.
 */
import { getDb } from "../lib/db.js";
import { signToken } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query;
  if (!token || token.length < 32)
    return res.status(400).json({ error: "Invalid verification link." });

  try {
    const db   = await getDb();
    const user = await db.collection("users").findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({
        error: "This verification link is invalid or has already been used.",
      });
    }

    if (new Date() > new Date(user.verificationTokenExpiry)) {
      return res.status(400).json({
        error: "This verification link has expired. Request a new one below.",
        expired: true,
        email: user.email,
      });
    }

    // Activate the account
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified:            true,
          verificationToken:        null,
          verificationTokenExpiry:  null,
          verifiedAt:               new Date(),
        },
      }
    );

    // Auto sign-in
    const jwtToken = signToken({
      userId: user._id.toString(),
      email:  user.email,
      name:   user.name,
    });

    res.json({
      ok:    true,
      token: jwtToken,
      user:  { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("[verify]", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
}
