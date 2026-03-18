const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, normalizeEmail } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();

    const body = JSON.parse(event.body || '{}');
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const uploads = body.uploads && typeof body.uploads === 'object' ? body.uploads : {};
    const submissionId = String(body.submissionId || '').trim();
    const email = normalizeEmail(payload.email);

    if (!submissionId || !email || !payload.firstName || !payload.lastName) {
      return json(400, { ok: false, error: 'missing_required_fields' });
    }

    await query(
      `
        INSERT INTO cohost_intake (
          id, email, first_name, last_name, city, zip, payload, uploads, status, source, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'submitted', 'skyehubs_intake_web', NOW(), NOW()
        )
      `,
      [
        submissionId,
        email,
        String(payload.firstName || '').trim(),
        String(payload.lastName || '').trim(),
        String(payload.city || '').trim() || null,
        String(payload.zip || '').trim() || null,
        JSON.stringify(payload),
        JSON.stringify(uploads),
      ]
    );

    return json(200, { ok: true, submissionId });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};