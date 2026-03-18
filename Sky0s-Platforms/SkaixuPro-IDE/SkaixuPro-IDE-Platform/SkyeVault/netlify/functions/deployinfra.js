import { json, safeJsonParse, getAuthBearer, isString } from "./_lib/utils.js";
import { verifyHS256 } from "./_lib/jwt.js";
import { runSql } from "./_lib/db.js";
import { putManifestObject } from "./_lib/r2.js";

function slugify(value) {
  return String(value || "stack")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "stack";
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    const signing = process.env.VAULT_SIGNING_SECRET;
    if (!isString(signing)) return json(500, { error: "missing_VAULT_SIGNING_SECRET" });

    const token = getAuthBearer(event);
    const v = verifyHS256(token, signing);
    if (!v.ok) return json(401, { error: v.error });

    const scopes = v.payload?.scopes || [];
    if (!Array.isArray(scopes) || !scopes.includes("infra:deploy")) return json(403, { error: "insufficient_scope" });

    const body = safeJsonParse(event.body || "{}", {});
    const stackId = body.stackId;
    const sqlBootstrap = body.sqlBootstrap || null;
    const r2Manifest = body.r2Manifest ?? null;
    const preferredBucket = body.r2Bucket || null;
    const r2PublicBaseUrl = body.r2PublicBaseUrl || null;
    const label = body.label || stackId || "vault-infra";

    if (!isString(stackId)) return json(400, { error: "missing_stackId" });

    const hasSql = isString(sqlBootstrap) && sqlBootstrap.trim().length > 0;
    const hasR2 = (typeof r2Manifest === "string" && r2Manifest.trim().length > 0) || (r2Manifest && typeof r2Manifest === "object");
    if (!hasSql && !hasR2) return json(400, { error: "no_infra_payload" });

    const deployed = {};

    if (hasSql) {
      deployed.neon = await runSql(sqlBootstrap);
    }

    if (hasR2) {
      const bucket = (preferredBucket || process.env.VAULT_R2_MANIFEST_BUCKET || "").trim();
      if (!bucket) return json(400, { error: "missing_r2_bucket" });

      const key = `vault-infra/${slugify(stackId)}/${Date.now()}-${slugify(label)}.json`;
      const manifestBody = typeof r2Manifest === "string" ? safeJsonParse(r2Manifest, { raw: r2Manifest }) : r2Manifest;
      await putManifestObject({
        bucket,
        key,
        body: {
          stackId,
          label,
          publishedAt: new Date().toISOString(),
          manifest: manifestBody
        }
      });

      deployed.r2 = {
        bucket,
        key,
        publicUrl: r2PublicBaseUrl ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${key}` : null
      };
    }

    return json(200, { ok: true, stackId, deployed });
  } catch (e) {
    return json(500, { error: "deploy_error", message: e.message });
  }
};