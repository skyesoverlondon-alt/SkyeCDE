const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initFirebaseAdmin(){
  if(admin.apps.length) return admin.app();
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");
  const cred = admin.credential.cert(JSON.parse(svc));
  return admin.initializeApp({ credential: cred });
}

function pickCohost(cohosts, req){
  const zip = (req.zip || "").trim();
  const city = (req.city || "").trim().toLowerCase();
  const pool = cohosts.filter(c=>{
    if(c.status && c.status !== "active") return false;
    if(zip && c.zip && String(c.zip).trim() === zip) return true;
    if(city && c.city && String(c.city).toLowerCase() === city) return true;
    return (!zip && !city);
  });
  return pool[0] || null;
}

exports.handler = async (event) => {
  try{
    const sessionId = (event.queryStringParameters?.session_id || "").trim();
    if(!sessionId) return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_session_id"}) };

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status !== "paid"){
      return { statusCode: 200, body: JSON.stringify({ok:false, error:"not_paid"}) };
    }

    const requestId = session.metadata?.requestId;
    const requestType = session.metadata?.requestType || "one_time";
    if(!requestId) return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_requestId"}) };

    initFirebaseAdmin();
    const db = admin.firestore();

    const reqRef = db.collection("host_requests").doc(requestId);
    const reqSnap = await reqRef.get();
    if(!reqSnap.exists) return { statusCode: 404, body: JSON.stringify({ok:false, error:"request_not_found"}) };
    const req = reqSnap.data();

    if(req.status === "paid_confirmed" || req.status === "stay_created"){
      return { statusCode: 200, body: JSON.stringify({ok:true, already:true, stayId: req.stayId || null}) };
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

    const cSnap = await db.collection("cohosts").where("status","==","active").get().catch(()=>null);
    const cohosts = cSnap ? cSnap.docs.map(d=>({id:d.id, ...d.data()})) : [];
    const chosen = pickCohost(cohosts, req);

    const stayPayload = {
      hostUid: req.hostUid,
      hostName: req.hostName || "",
      hostEmail: req.hostEmail || "",
      cohostUid: chosen ? chosen.uid : null,
      cohostName: chosen ? (chosen.name || "") : "",
      listingName: req.listingName || "",
      address: req.address || "",
      city: req.city || "",
      zip: req.zip || "",
      startDate: req.startDate || "",
      endDate: req.endDate || "",
      turnoverDate: req.turnoverDate || "",
      serviceType: req.serviceType || "turnover",
      addOns: req.addOns || {},
      guestComms: req.guestComms || "no",
      notes: req.notes || "",
      requestType: req.requestType || requestType,
      plan: req.plan || "none",
      quote: req.quote || null,
      requestId,
      status: chosen ? "scheduled" : "pending_assignment",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const stayRef = await db.collection("stays").add(stayPayload);

    let subscriptionId = null;
    if((req.requestType === "subscription") && req.plan && req.plan !== "none"){
      const subRef = await db.collection("subscriptions").add({
        hostUid: req.hostUid,
        hostEmail: req.hostEmail || "",
        plan: req.plan,
        status: "active",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        latestStayId: stayRef.id
      });
      subscriptionId = subRef.id;
      await stayRef.set({ subscriptionId }, { merge:true });
    }

    await reqRef.set({
      status: "stay_created",
      stayId: stayRef.id,
      cohostAssigned: chosen ? true : false,
      subscriptionId
    }, { merge:true });

    return { statusCode: 200, body: JSON.stringify({ok:true, stayId: stayRef.id, cohostAssigned: !!chosen, subscriptionId}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
