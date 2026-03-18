import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { clearSoleSessionCookie, ensureSoleSalesSchema, parseCookies } from "./_shared/sole_sales";

export const handler = async (event: any) => {
  try {
    await ensureSoleSalesSchema();
    const cookies = parseCookies(event.headers?.cookie);
    const token = cookies.sole_contractor_session;
    if (token) {
      await q("delete from sole_contractor_sessions where token = $1", [token]);
    }
  } catch {
    // ignore cleanup failures
  }
  return json(200, { ok: true }, { "Set-Cookie": clearSoleSessionCookie(event) });
};