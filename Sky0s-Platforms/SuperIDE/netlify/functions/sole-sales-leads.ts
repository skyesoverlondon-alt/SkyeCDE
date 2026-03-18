import crypto from "crypto";
import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { ensureSoleSalesSchema, normalizeLead, requireSoleContractor } from "./_shared/sole_sales";

function parseIso(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export const handler = async (event: any) => {
  try {
    await ensureSoleSalesSchema();
    const contractor = await requireSoleContractor(event);
    if (!contractor) return json(401, { error: "Unauthorized." });

    if (event.httpMethod === "GET") {
      const result = await q(
        `select *
           from sole_sales_leads
          where contractor_id = $1
          order by updated_at desc, created_at desc`,
        [contractor.id]
      );
      return json(200, { ok: true, leads: result.rows.map(normalizeLead) });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const leadId = String(body.id || "").trim() || crypto.randomUUID();
      const businessName = String(body.businessName || "").trim();
      if (!businessName) return json(400, { error: "Business name is required." });
      const nextStepAt = parseIso(body.nextStepAt);
      await q(
        `insert into sole_sales_leads (
           id, contractor_id, business_name, contact_name, phone, email, instagram, website,
           city, niche, stage, next_step_at, recommended_package, production_interest,
           notes, last_activity_at, created_at, updated_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,
           $9,$10,$11,$12,$13,$14,
           $15,$16,now(),now()
         )
         on conflict (id) do update set
           business_name = excluded.business_name,
           contact_name = excluded.contact_name,
           phone = excluded.phone,
           email = excluded.email,
           instagram = excluded.instagram,
           website = excluded.website,
           city = excluded.city,
           niche = excluded.niche,
           stage = excluded.stage,
           next_step_at = excluded.next_step_at,
           recommended_package = excluded.recommended_package,
           production_interest = excluded.production_interest,
           notes = excluded.notes,
           updated_at = now()
         where sole_sales_leads.contractor_id = $2`,
        [
          leadId,
          contractor.id,
          businessName,
          String(body.contactName || "").trim() || null,
          String(body.phone || "").trim() || null,
          String(body.email || "").trim() || null,
          String(body.instagram || "").trim() || null,
          String(body.website || "").trim() || null,
          String(body.city || "").trim() || null,
          String(body.niche || "").trim() || null,
          String(body.stage || "New Lead (Unworked)").trim() || "New Lead (Unworked)",
          nextStepAt,
          String(body.recommendedPackage || "").trim() || null,
          String(body.productionInterest || "").trim() || null,
          String(body.notes || "").trim() || null,
          parseIso(body.lastActivityAt),
        ]
      );
      return json(200, { ok: true, leadId });
    }

    return json(405, { error: "Method not allowed." });
  } catch {
    return json(500, { error: "Lead request failed." });
  }
};