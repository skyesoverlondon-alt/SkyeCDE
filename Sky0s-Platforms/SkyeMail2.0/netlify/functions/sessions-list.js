const { query } = require("./_db");
const { json, verifyAuthSession, requireMethod} = require("./_utils");

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const r = await query(
      `select jti, created_at, last_seen_at, expires_at, revoked_at, revoke_reason, ip_hash, user_agent
       from sessions
       where user_id=$1
       order by created_at desc
       limit 50`,
      [userId]
    );

    return json(200, { current_jti: auth.jti, sessions: r.rows });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
