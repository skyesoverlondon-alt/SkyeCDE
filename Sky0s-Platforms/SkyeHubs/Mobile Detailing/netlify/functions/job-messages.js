const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, requireUser } = require('./_lib/auth');

async function loadJob(jobId) {
  const result = await query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [jobId]);
  return result.rows[0] || null;
}

function canAccessJob(user, job) {
  return user.role === 'admin' || job.client_uid === user.id || job.detailer_uid === user.id;
}

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const user = await requireUser(event);
    if (!user) return json(401, { ok: false, error: 'unauthorized' });

    if (event.httpMethod === 'GET') {
      const jobId = String(event.queryStringParameters?.bookingId || event.queryStringParameters?.jobId || '').trim();
      if (!jobId) return json(400, { ok: false, error: 'missing_job_id' });
      const job = await loadJob(jobId);
      if (!job) return json(404, { ok: false, error: 'job_not_found' });
      if (!canAccessJob(user, job)) return json(403, { ok: false, error: 'forbidden' });
      const messages = await query('SELECT id, text, from_user_id, from_role, created_at FROM job_messages WHERE job_id = $1 ORDER BY created_at ASC', [jobId]);
      return json(200, { ok: true, messages: messages.rows });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const jobId = String(body.bookingId || body.jobId || '').trim();
      const text = String(body.text || '').trim();
      if (!jobId || !text) return json(400, { ok: false, error: 'missing_fields' });
      const job = await loadJob(jobId);
      if (!job) return json(404, { ok: false, error: 'job_not_found' });
      if (!canAccessJob(user, job)) return json(403, { ok: false, error: 'forbidden' });
      await query(
        'INSERT INTO job_messages (id, job_id, text, from_user_id, from_role, created_at) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())',
        [jobId, text, user.id, user.role]
      );
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: 'method_not_allowed' });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};
