import crypto from "crypto";
import { json } from "./_shared/response";
import { hashPassword } from "./_shared/auth";
import { q } from "./_shared/neon";
import {
  boolFromEnv,
  createSoleSession,
  ensureSoleSalesSchema,
  normalizeEmail,
  setSoleSessionCookie,
} from "./_shared/sole_sales";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
    await ensureSoleSalesSchema();
    const body = JSON.parse(event.body || "{}");
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const inviteCode = String(body.inviteCode || "").trim();
    const requiredInviteCode = String(process.env.SOLE_CONTRACTOR_INVITE_CODE || "").trim();
    const autoApprove = boolFromEnv(process.env.SOLE_CONTRACTOR_AUTO_APPROVE, true);

    if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address." });
    if (password.length < 8) return json(400, { error: "Password must be at least 8 characters." });
    if (requiredInviteCode && inviteCode !== requiredInviteCode) {
      return json(403, { error: "Invite code is invalid." });
    }

    const existing = await q("select id from sole_contractors where lower(email)=lower($1) limit 1", [email]);
    if (existing.rows.length) return json(409, { error: "Account already exists. Sign in instead." });

    const contractorId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const status = autoApprove ? "approved" : "pending";
    await q(
      `insert into sole_contractors(id, email, password_hash, status, created_at, updated_at)
       values($1,$2,$3,$4,now(),now())`,
      [contractorId, email, passwordHash, status]
    );
    const session = await createSoleSession(contractorId);
    return json(
      200,
      {
        ok: true,
        user: { id: contractorId, email, status },
        message: status === "approved" ? "Account created and approved." : "Account created and waiting for approval.",
      },
      { "Set-Cookie": setSoleSessionCookie(session.token, session.expires, event) }
    );
  } catch {
    return json(500, { error: "Signup failed." });
  }
};