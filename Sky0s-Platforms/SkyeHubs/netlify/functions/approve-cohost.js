const admin = require("firebase-admin");

function initFirebaseAdmin(){
  if(admin.apps.length) return admin.app();
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
}
function genTempPassword(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let out = "";
  for(let i=0;i<14;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ok:false, error:"method_not_allowed"}) };
    initFirebaseAdmin();
    const db = admin.firestore();

    const body = JSON.parse(event.body || "{}");
    const submissionId = (body.submissionId || "").trim();
    if(!submissionId) return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_submissionId"}) };

    const ref = db.collection("cohost_intake").doc(submissionId);
    const snap = await ref.get();
    if(!snap.exists) return { statusCode: 404, body: JSON.stringify({ok:false, error:"submission_not_found"}) };
    const data = snap.data() || {};

    const email = (data.contact?.email || "").trim().toLowerCase();
    const name  = (data.contact?.fullName || "").trim();
    const city  = (data.home?.city || "").trim();
    const zip   = (data.home?.zip || "").trim();
    const maxTurns = parseInt(data.capacity?.maxPets || "0", 10) || 2; // reuse field key
    const supplies = (data.experience?.medsExperience || "Unknown").trim(); // reuse key
    const hasLinen  = String(data.home?.fencedYard || "").toLowerCase().includes("yes") ? "yes" : "unknown"; // reuse key

    if(!email) return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_email_in_intake"}) };

    let user = null;
    try{ user = await admin.auth().getUserByEmail(email); }catch(_e){ user = null; }

    let tempPassword = null;
    if(!user){
      tempPassword = genTempPassword();
      user = await admin.auth().createUser({ email, password: tempPassword, displayName: name || undefined });
    }
    const uid = user.uid;

    await db.collection("users").doc(uid).set({
      role: "cohost",
      email,
      name,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge:true });

    await db.collection("cohosts").doc(uid).set({
      uid, email, name, city, zip,
      maxTurnsPerDay: maxTurns,
      supplies: supplies,
      linenAccess: hasLinen,
      status: "active",
      source: "intake_approval",
      submissionId,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge:true });

    await ref.set({
      status: "approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedUid: uid,
      approvedEmail: email
    }, { merge:true });

    return { statusCode: 200, body: JSON.stringify({ok:true, uid, email, tempPassword}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
