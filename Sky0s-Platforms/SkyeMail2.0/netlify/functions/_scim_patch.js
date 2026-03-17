// Pure SCIM PATCH/PUT helpers (no external deps). Used by functions and tests.
function applyUserPatchOps(body){
  const out = {};
  const ops = Array.isArray(body.Operations) ? body.Operations : [];
  for(const op of ops){
    const operation = String(op.op || op.operation || "").toLowerCase();
    const path = String(op.path || "").toLowerCase();
    const value = op.value;

    if(operation !== "add" && operation !== "replace" && operation !== "remove") continue;

    if(path === "active" || (path === "" && value && typeof value.active === "boolean")){
      const v = (path === "active") ? value : value.active;
      if(typeof v === "boolean") out.active = v;
    }

    if(path === "username" || path === "username".toLowerCase() || (path === "" && value && typeof value.userName === "string")){
      const v = (path ? value : value.userName);
      if(typeof v === "string") out.email = String(v).trim().toLowerCase();
    }

    if(path.startsWith("emails") || (path === "" && value && Array.isArray(value.emails))){
      const arr = (path ? value : value.emails);
      if(Array.isArray(arr) && arr.length && arr[0] && arr[0].value){
        out.email = String(arr[0].value).trim().toLowerCase();
      }
    }
  }
  return out;
}

function normalizeMembers(members){
  const out = [];
  if(!members) return out;
  if(Array.isArray(members)){
    for(const m of members){
      const id = m && (m.value || m.id);
      if(id) out.push(String(id));
    }
  }else if(typeof members === "object"){
    const id = members.value || members.id;
    if(id) out.push(String(id));
  }
  return out;
}

function applyGroupPatchOps(body){
  const ops = Array.isArray(body.Operations) ? body.Operations : [];
  const add = [];
  const remove = [];
  for(const op of ops){
    const operation = String(op.op || op.operation || "").toLowerCase();
    const path = String(op.path || "").toLowerCase();
    const value = op.value;

    if(path && path !== "members") continue;

    const members = normalizeMembers(Array.isArray(value) ? value : (value && value.members ? value.members : value));
    if(!members.length) continue;

    if(operation === "add" || operation === "replace"){
      add.push(...members);
    }else if(operation === "remove"){
      remove.push(...members);
    }
  }
  return { add: Array.from(new Set(add)), remove: Array.from(new Set(remove)) };
}

module.exports = { applyUserPatchOps, applyGroupPatchOps, normalizeMembers };
