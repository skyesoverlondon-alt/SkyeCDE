function getStripe(){
  if(!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY env var");
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}
const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');

// Required env vars for this payment finalizer:
// STRIPE_SECRET_KEY and DATABASE_URL.
// SITE_URL or URL is required by create-checkout, and DEFAULT_DEPOSIT_CENTS is optional for checkout sizing.
// STRIPE_WEBHOOK_SECRET is not currently consumed because this hub finalizes from success.html.

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
    await ensureSchema();
    const sessionId = (event.queryStringParameters?.session_id || "").trim();
    if(!sessionId){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_session_id"}) };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status !== "paid"){
      return { statusCode: 200, body: JSON.stringify({ok:false, error:"not_paid"}) };
    }

    const requestId = session.metadata?.requestId;
    if(!requestId){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_requestId"}) };
    }

    const reqRes = await query('SELECT * FROM booking_requests WHERE id = $1 LIMIT 1', [requestId]);
    if(!reqRes.rowCount){
      return { statusCode: 404, body: JSON.stringify({ok:false, error:"request_not_found"}) };
    }
    const req = reqRes.rows[0];
    const payload = req.payload || {};

    if(req.status === "paid_confirmed" || req.status === "booking_created"){
      return { statusCode: 200, body: JSON.stringify({ok:true, already:true, bookingId: req.booking_id || null}) };
    }

    await query(
      `
        UPDATE booking_requests
        SET status = 'paid_confirmed', paid_at = NOW(), updated_at = NOW(), stripe_session_id = $2, stripe_amount_total = $3, stripe_currency = $4
        WHERE id = $1
      `,
      [requestId, session.id, session.amount_total || null, session.currency || null]
    );

    const caregiversRes = await query('SELECT uid, email, name, city, cats_ok, meds_ok, max_pets, status FROM caregivers WHERE status = $1', ['active']).catch(() => ({ rows: [] }));
    const caregivers = (caregiversRes.rows || []).map((row) => ({
      uid: row.uid,
      email: row.email,
      name: row.name,
      city: row.city,
      catsOk: row.cats_ok,
      medsOk: row.meds_ok,
      maxPets: row.max_pets,
      status: row.status,
    }));

    const chosen = pickCaregiver(caregivers, payload);

    const booking = await query(
      `
        INSERT INTO bookings (
          id, client_uid, client_name, client_email, caregiver_uid, caregiver_name,
          pet_name, pet_type, start_date, end_date, notes, city, zip, service, quote, status, source_request_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, NOW(), NOW()
        )
        RETURNING id
      `,
      [
        req.client_uid,
        String(payload.clientName || '').trim() || null,
        req.client_email,
        chosen ? chosen.uid : null,
        chosen ? (chosen.name || '') : null,
        String(payload.petName || '').trim() || null,
        String(payload.petType || '').trim() || null,
        String(payload.startDate || '').trim() || null,
        String(payload.endDate || '').trim() || null,
        String(payload.notes || '').trim() || null,
        String(payload.city || '').trim() || null,
        String(payload.zip || '').trim() || null,
        String(payload.service || 'boarding').trim(),
        JSON.stringify(req.quote || {}),
        chosen ? 'active' : 'pending_placement',
        requestId,
      ]
    );

    await query(
      `
        UPDATE booking_requests
        SET status = 'booking_created', updated_at = NOW(), booking_id = $2, caregiver_uid = $3, caregiver_name = $4
        WHERE id = $1
      `,
      [requestId, booking.rows[0].id, chosen ? chosen.uid : null, chosen ? (chosen.name || '') : null]
    );

    return { statusCode: 200, body: JSON.stringify({ok:true, bookingId: booking.rows[0].id, caregiverAssigned: !!chosen}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
