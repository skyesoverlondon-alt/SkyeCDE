import { json } from "./_shared/response";
import { verifyPassword } from "./_shared/auth";
import { q } from "./_shared/neon";
import {
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

    if (!EMAIL_RE.test(email) || !password) {
      return json(400, { error: "Email and password are required." });
    }

    const result = await q(
      `select id, email, status, password_hash
         from sole_contractors
        where lower(email)=lower($1)
        limit 1`,
      [email]
    );
    if (!result.rows.length) return json(401, { error: "Invalid credentials." });
    const contractor = result.rows[0];
    const ok = await verifyPassword(password, contractor.password_hash);
    if (!ok) return json(401, { error: "Invalid credentials." });
    const session = await createSoleSession(contractor.id);
    await q("update sole_contractors set updated_at = now() where id = $1", [contractor.id]);
    return json(
      200,
      { ok: true, user: { id: contractor.id, email: contractor.email, status: contractor.status } },
      { "Set-Cookie": setSoleSessionCookie(session.token, session.expires, event) }
    );
  } catch {
    return json(500, { error: "Login failed." });
  }
};