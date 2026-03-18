import { json } from "./_shared/response";
import { ensureSoleSalesSchema, requireSoleContractor } from "./_shared/sole_sales";

export const handler = async (event: any) => {
  try {
    await ensureSoleSalesSchema();
    const contractor = await requireSoleContractor(event);
    if (!contractor) return json(401, { error: "Unauthorized." });
    return json(200, {
      ok: true,
      user: {
        id: contractor.id,
        email: contractor.email,
        status: contractor.status,
      },
    });
  } catch {
    return json(500, { error: "Session lookup failed." });
  }
};