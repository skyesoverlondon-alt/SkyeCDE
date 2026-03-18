const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');
const { hashPassword, json, normalizeEmail, requireRole } = require('./_lib/auth');

function genTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let out = '';
  for (let i = 0; i < 14; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();
    const auth = await requireRole(event, ['admin']);
    if (!auth.ok) return auth.response;

    const body = JSON.parse(event.body || '{}');
    const submissionId = String(body.submissionId || '').trim();
    if (!submissionId) return json(400, { ok: false, error: 'missing_submissionId' });

    const submission = await query('SELECT * FROM detailer_intake WHERE id = $1 LIMIT 1', [submissionId]);
    if (!submission.rowCount) return json(404, { ok: false, error: 'submission_not_found' });

    const data = submission.rows[0];
    const payload = data.payload || {};
    const email = normalizeEmail(data.email || payload.email);
    const name = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();
    const city = String(data.city || payload.city || '').trim() || null;
    const zip = String(payload.zip || '').trim() || null;
    const waterAccess = String(payload.waterAccess || payload.hasWaterAccess || '').trim() || 'unknown';
    const tools = String(payload.tools || payload.equipment || payload.medsExperience || '').trim() || 'Unknown';
    const maxVehicles = parseInt(payload.maxVehicles || payload.maxPets || '0', 10) || null;

    if (!email) return json(400, { ok: false, error: 'missing_email_in_intake' });

    const existing = await query('SELECT id FROM hub_users WHERE email = $1 LIMIT 1', [email]);
    let uid = existing.rows[0]?.id || null;
    let tempPassword = null;

    if (!uid) {
      tempPassword = genTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const created = await query(
        `
          INSERT INTO hub_users (id, email, password_hash, role, name, status, approved_at, created_at, updated_at)
          VALUES (gen_random_uuid()::text, $1, $2, 'detailer', $3, 'active', NOW(), NOW(), NOW())
          RETURNING id
        `,
        [email, passwordHash, name || null]
      );
      uid = created.rows[0].id;
    } else {
      await query(
        'UPDATE hub_users SET role = $2, name = COALESCE($3, name), status = $4, approved_at = NOW(), updated_at = NOW() WHERE id = $1',
        [uid, 'detailer', name || null, 'active']
      );
    }

    await query(
      `
        INSERT INTO detailers (uid, email, name, city, zip, max_vehicles, water_access, tools, status, source, submission_id, approved_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'intake_approval', $9, NOW(), NOW())
        ON CONFLICT (uid) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          zip = EXCLUDED.zip,
          max_vehicles = EXCLUDED.max_vehicles,
          water_access = EXCLUDED.water_access,
          tools = EXCLUDED.tools,
          status = 'active',
          source = 'intake_approval',
          submission_id = EXCLUDED.submission_id,
          approved_at = NOW(),
          updated_at = NOW()
      `,
      [uid, email, name || null, city, zip, maxVehicles, waterAccess, tools, submissionId]
    );

    await query(
      `
        UPDATE detailer_intake
        SET status = 'approved', approved_at = NOW(), updated_at = NOW(), approved_user_id = $2
        WHERE id = $1
      `,
      [submissionId, uid]
    );

    return json(200, { ok: true, uid, email, tempPassword });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};
