const { ensureSchema } = require('./_lib/schema');
const { json, requireUser } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const user = await requireUser(event);
    if (!user) return json(401, { ok: false, error: 'unauthorized' });
    return json(200, { ok: true, user });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};