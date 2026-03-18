import crypto from "crypto";
import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { ensureSoleSalesSchema, normalizeActivity, requireSoleContractor } from "./_shared/sole_sales";

async function ensureLeadOwner(leadId: string, contractorId: string) {
  const result = await q(
    "select id from sole_sales_leads where id = $1 and contractor_id = $2 limit 1",
    [leadId, contractorId]
  );
  return result.rows.length > 0;
}

export const handler = async (event: any) => {
  try {
    await ensureSoleSalesSchema();
    const contractor = await requireSoleContractor(event);
    if (!contractor) return json(401, { error: "Unauthorized." });

    if (event.httpMethod === "GET") {
      const leadId = String(event.queryStringParameters?.leadId || "").trim();
      if (!leadId) return json(400, { error: "Lead id is required." });
      if (!(await ensureLeadOwner(leadId, contractor.id))) return json(404, { error: "Lead not found." });
      const result = await q(
        `select *
           from sole_sales_activities
          where lead_id = $1 and contractor_id = $2
          order by created_at desc
          limit 50`,
        [leadId, contractor.id]
      );
      return json(200, { ok: true, activities: result.rows.map(normalizeActivity) });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const leadId = String(body.leadId || "").trim();
      const channel = String(body.channel || "Activity").trim() || "Activity";
      const note = String(body.note || "");
      if (!leadId) return json(400, { error: "Lead id is required." });
      if (!(await ensureLeadOwner(leadId, contractor.id))) return json(404, { error: "Lead not found." });
      await q(
        `insert into sole_sales_activities (id, lead_id, contractor_id, channel, note, created_at)
         values ($1,$2,$3,$4,$5,now())`,
        [crypto.randomUUID(), leadId, contractor.id, channel, note]
      );
      await q(
        `update sole_sales_leads
            set last_activity_at = now(), updated_at = now()
          where id = $1 and contractor_id = $2`,
        [leadId, contractor.id]
      );
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed." });
  } catch {
    return json(500, { error: "Activity request failed." });
  }
};