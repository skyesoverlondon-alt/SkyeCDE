const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initFirebaseAdmin(){
  if(admin.apps.length) return admin.app();
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");
  const cred = admin.credential.cert(JSON.parse(svc));
  return admin.initializeApp({ credential: cred });
}

function pickDetailer(detailers, req){
  // MVP matcher: ZIP match preferred, else city substring; filter by status active and vehicleCount capacity.
  const zip = (req.zip || "").trim();
  const addr = (req.address || "").toLowerCase();
  const vehicleCount = parseInt(req.vehicleCount || "1", 10) || 1;

  const pool = detailers.filter(d=>{
    if(d.status && d.status !== "active") return false;
    const max = parseInt(d.maxVehiclesPerSlot || d.maxVehicles || "0", 10) || 0;
    if(max && vehicleCount > max) return false;

    if(zip && d.zip && String(d.zip).trim() === zip) return true;
    if(d.city && addr.includes(String(d.city).toLowerCase())) return true;
    return !zip && !d.zip; // fallback
  });

  return pool[0] || null;
}

exports.handler = async (event) => {
  try{
    const sessionId = (event.queryStringParameters?.session_id || "").trim();
    if(!sessionId){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_session_id"}) };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status !== "paid"){
      return { statusCode: 200, body: JSON.stringify({ok:false, error:"not_paid"}) };
    }

    const requestId = session.metadata?.requestId;
    const requestType = session.metadata?.requestType || "one_time";
    if(!requestId){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_requestId"}) };
    }

    initFirebaseAdmin();
    const db = admin.firestore();

    const reqRef = db.collection("service_requests").doc(requestId);
    const reqSnap = await reqRef.get();
    if(!reqSnap.exists){
      return { statusCode: 404, body: JSON.stringify({ok:false, error:"request_not_found"}) };
    }
    const req = reqSnap.data();

    // Idempotency
    if(req.status === "paid_confirmed" || req.status === "job_created"){
      return { statusCode: 200, body: JSON.stringify({ok:true, already:true, jobId: req.jobId || null}) };
    }

    await reqRef.set({
      status: "paid_confirmed",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      stripe: {
        sessionId: session.id,
        amount_total: session.amount_total,
        currency: session.currency
      }
    }, { merge:true });

    // Load detailers for matching
    const dSnap = await db.collection("detailers").where("status","==","active").get().catch(()=>null);
    const detailers = dSnap ? dSnap.docs.map(doc=>({id: doc.id, ...doc.data()})) : [];
    const chosen = pickDetailer(detailers, req);

    // Create job
    const jobPayload = {
      clientUid: req.clientUid,
      clientName: req.clientName || "",
      clientEmail: req.clientEmail || "",
      detailerUid: chosen ? chosen.uid : null,
      detailerName: chosen ? (chosen.name || "") : "",
      address: req.address || "",
      zip: req.zip || "",
      preferredDate: req.preferredDate || "",
      timeWindow: req.timeWindow || "",
      vehicleCount: req.vehicleCount || "1",
      vehicleType: req.vehicleType || "",
      vehicleLabel: req.vehicleType ? `${req.vehicleType} x${req.vehicleCount||1}` : `Vehicle x${req.vehicleCount||1}`,
      serviceLevel: req.serviceLevel || "",
      interior: req.interior || "yes",
      heavySoil: req.heavySoil || "no",
      addons: {
        engine: req.engine || "no",
        headlights: req.headlights || "no",
        odor: req.odor || "no"
      },
      requestType: req.requestType || requestType,
      plan: req.plan || "none",
      quote: req.quote || null,
      requestId,
      status: chosen ? "scheduled" : "pending_assignment",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const jobRef = await db.collection("jobs").add(jobPayload);

    // Subscriptions collection (MVP): record subscription intent and active flag
    let subscriptionId = null;
    if((req.requestType === "subscription") && req.plan && req.plan !== "none"){
      const subRef = await db.collection("subscriptions").add({
        clientUid: req.clientUid,
        clientEmail: req.clientEmail || "",
        plan: req.plan,
        status: "active",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        latestJobId: jobRef.id
      });
      subscriptionId = subRef.id;
      await jobRef.set({ subscriptionId }, { merge:true });
    }

    await reqRef.set({
      status: "job_created",
      jobId: jobRef.id,
      detailerAssigned: chosen ? true : false,
      subscriptionId
    }, { merge:true });

    return { statusCode: 200, body: JSON.stringify({ok:true, jobId: jobRef.id, detailerAssigned: !!chosen, subscriptionId}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
