const { query } = require("./_db");

function safeJsonParse(s, fallback){
  try{ return JSON.parse(s); }catch(e){ return fallback; }
}

function scanText(patterns, text){
  const matches = [];
  const t = String(text || "");
  for(const p of patterns){
    if(!p || !p.value) continue;
    const type = p.type || "keyword";
    const label = p.label || p.value;
    if(type === "regex"){
      try{
        const rx = new RegExp(p.value, "i");
        if(rx.test(t)) matches.push({ type:"regex", label, value:p.value });
      }catch(e){}
    }else{
      if(t.toLowerCase().includes(String(p.value).toLowerCase())){
        matches.push({ type:"keyword", label, value:p.value });
      }
    }
  }
  return matches;
}

async function getDlpPolicy(orgId){
  if(!orgId) return { action:"off", patterns:[] };
  const r = await query(`select action, patterns_json from dlp_policies where org_id=$1 limit 1`, [orgId]);
  if(!r.rows.length) return { action:"off", patterns:[] };
  const action = r.rows[0].action || "off";
  const patterns = safeJsonParse(r.rows[0].patterns_json, []);
  return { action, patterns: Array.isArray(patterns)?patterns:[] };
}

async function evaluateDlp({ orgId, actorUserId, source, text }){
  const policy = await getDlpPolicy(orgId);
  if(policy.action === "off") return { decision:"allow", matches:[] };

  const matches = scanText(policy.patterns, text);
  if(!matches.length) return { decision:"allow", matches:[] };

  const decision = (policy.action === "block") ? "block" : "warn";

  // record event (best effort)
  try{
    await query(
      `insert into dlp_events(org_id, actor_user_id, source, decision, matches_json)
       values($1,$2,$3,$4,$5)`,
      [orgId, actorUserId||null, source||null, decision, JSON.stringify(matches).slice(0,20000)]
    );
  }catch(e){}

  return { decision, matches };
}

module.exports = { getDlpPolicy, evaluateDlp };
