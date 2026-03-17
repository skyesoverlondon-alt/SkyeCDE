const { jsonCookies, clearAuthCookies, verifyAuthSession, revokeSessionByJti, requireCsrf } = require("./_utils");

exports.handler = async (event) => {
  try{
    if((event.httpMethod||"GET").toUpperCase() !== "POST"){
      return { statusCode: 405, headers: { "Content-Type":"application/json", "Cache-Control":"no-store" }, body: JSON.stringify({ error:"Method not allowed" }) };
    }
    requireCsrf(event);
    const auth = await verifyAuthSession(event, { touch:false });
    await revokeSessionByJti(auth.sub, auth.jti, "logout");
  }catch(e){
    // Always clear cookies even if session lookup fails
  }
  const cookies = clearAuthCookies();
  return jsonCookies(200, { ok:true }, cookies);
};
