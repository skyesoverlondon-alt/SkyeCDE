const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

function initFirebaseAdmin(){
  if(admin.apps.length) return admin.app();
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");
  const cred = admin.credential.cert(JSON.parse(svc));
  return admin.initializeApp({ credential: cred });
}

function pickCaregiver(caregivers, req){
  // Simple MVP matcher: same city, accepts cats if needed, meds capability rough, capacity not enforced.
  const city = (req.city || "").toLowerCase();
  const petType = (req.petType || "").toLowerCase();
  const meds = (req.meds || "").toLowerCase();

  const needCatOk = petType === "cat";
  const needMeds = meds.startsWith("yes");

  const pool = caregivers.filter(c=>{
    if(c.status && c.status !== "active") return false;
    if(city && c.city && String(c.city).toLowerCase() !== city) return false;

    if(needCatOk && c.catsOk === false) return false;

    if(needMeds){
      // allow if caregiver medsOk exists and isn't "No"
      const mo = (c.medsOk || "").toLowerCase();
      if(!mo || mo === "no") return false;
    }
    return true;
  });

  // naive: pick one with lowest maxPets first? we'll just return first.
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
    if(!requestId){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_requestId"}) };
    }

    initFirebaseAdmin();
    const db = admin.firestore();

    // mark request paid
    const reqRef = db.collection("booking_requests").doc(requestId);
    const reqSnap = await reqRef.get();
    if(!reqSnap.exists){
      return { statusCode: 404, body: JSON.stringify({ok:false, error:"request_not_found"}) };
    }
    const req = reqSnap.data();

    // idempotency: if already finalized, just ok
    if(req.status === "paid_confirmed" || req.status === "booking_created"){
      return { statusCode: 200, body: JSON.stringify({ok:true, already:true}) };
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

    // Try auto-assign caregiver
    const caregiversSnap = await db.collection("caregivers").where("status","==","active").get().catch(()=>null);
    const caregivers = caregiversSnap ? caregiversSnap.docs.map(d=>({id:d.id, ...d.data()})) : [];

    const chosen = pickCaregiver(caregivers, req);

    // Create booking doc
    const bookingPayload = {
      clientUid: req.clientUid,
      clientName: req.clientName || "",
      clientEmail: req.clientEmail || "",
      caregiverUid: chosen ? chosen.uid : null,
      caregiverName: chosen ? (chosen.name || "") : "",
      petName: req.petName || "",
      petType: req.petType || "",
      startDate: req.startDate,
      endDate: req.endDate,
      notes: req.notes || "",
      city: req.city || "",
      zip: req.zip || "",
      service: req.service || "boarding",
      quote: req.quote || null,
      requestId,
      status: chosen ? "active" : "pending_placement",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const bookingRef = await db.collection("bookings").add(bookingPayload);

    await reqRef.set({
      status: "booking_created",
      bookingId: bookingRef.id,
      caregiverAssigned: chosen ? true : false
    }, { merge:true });

    return { statusCode: 200, body: JSON.stringify({ok:true, bookingId: bookingRef.id, caregiverAssigned: !!chosen}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
