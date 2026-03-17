const { query } = require("./_db");

async function getOrgAndRoleForUser(userId){
  const u = await query(
    `select u.org_id, om.role, o.name, o.slug, o.key_management_mode, o.kms_key_id
     from users u
     left join org_members om on om.user_id=u.id and om.org_id=u.org_id
     left join organizations o on o.id=u.org_id
     where u.id=$1 limit 1`,
    [userId]
  );
  if(!u.rows.length) return { org:null, role:null };
  const r=u.rows[0];
  if(!r.org_id) return { org:null, role:null };
  return {
    org: {
      id: r.org_id,
      name: r.name,
      slug: r.slug,
      key_management_mode: r.key_management_mode,
      kms_key_id: r.kms_key_id
    },
    role: r.role || null
  };
}

function requireRole(role, allowed){
  return allowed.includes(role);
}

async function requireOrgRole(userId, allowedRoles){
  const { org, role } = await getOrgAndRoleForUser(userId);
  if(!org) {
    const err = new Error("User is not in an organization");
    err.statusCode = 403;
    throw err;
  }
  if(!role || !requireRole(role, allowedRoles)){
    const err = new Error("Insufficient role");
    err.statusCode = 403;
    throw err;
  }
  return { org, role };
}

module.exports = { getOrgAndRoleForUser, requireOrgRole };
