import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { ensureSoleSalesSchema, normalizeTemplate, requireSoleContractor } from "./_shared/sole_sales";

export const handler = async (event: any) => {
  try {
    await ensureSoleSalesSchema();
    const contractor = await requireSoleContractor(event);
    if (!contractor) return json(401, { error: "Unauthorized." });

    if (event.httpMethod === "GET") {
      const result = await q(
        `select *
           from sole_sales_templates
          where published = true
          order by channel asc, title asc`,
        []
      );
      return json(200, { ok: true, templates: result.rows.map(normalizeTemplate) });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const templates = Array.isArray(body.templates) ? body.templates : [];
      for (const item of templates) {
        const id = String(item.id || `${item.channel || "template"}-${item.title || "item"}`)
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "template";
        await q(
          `insert into sole_sales_templates (id, channel, title, body, published, updated_at)
           values ($1,$2,$3,$4,true,now())
           on conflict (id) do update set
             channel = excluded.channel,
             title = excluded.title,
             body = excluded.body,
             published = true,
             updated_at = now()`,
          [
            id,
            String(item.channel || "").trim() || "DM",
            String(item.title || "Script").trim() || "Script",
            String(item.text || item.body || "").trim(),
          ]
        );
      }
      return json(200, { ok: true, count: templates.length });
    }

    return json(405, { error: "Method not allowed." });
  } catch {
    return json(500, { error: "Template request failed." });
  }
};