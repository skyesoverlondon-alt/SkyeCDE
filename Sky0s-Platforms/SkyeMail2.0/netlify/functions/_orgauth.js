const { query } = require("./_db");
const { verifyAuthSession, json } = require("./_utils");

async function getOrgContext(event){
  const auth = await verifyAuthSession(event);
  const userId = auth.sub;

  const u = await query(`select org_id, is_active, email, handle from users where id=$1 limit 1`, [userId]);
  const orgId = u.rows.length ? u.rows[0].org_id : null;

  if(!orgId){
    const err = new Error("User is not in an organization.");
    err.statusCode = 409;
    throw err;
  }

  const m = await query(
    `select role from org_members where org_id=$1 and user_id=$2 limit 1`,
    [orgId, userId]
  );
  const role = m.rows.length ? m.rows[0].role : "viewer";

  const o = await query(`select * from organizations where id=$1 limit 1`, [orgId]);
  const org = o.rows.length ? o.rows[0] : null;

  return { auth, userId, orgId, role, org, user: u.rows[0] };
}

function requireAdmin(role){
  if(role !== "owner" && role !== "admin"){
    const err = new Error("Forbidden: admin role required.");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { getOrgContext, requireAdmin };
