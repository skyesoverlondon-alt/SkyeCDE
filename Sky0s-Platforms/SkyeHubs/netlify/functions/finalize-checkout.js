function getStripe(){
  if(!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY env var");
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

const crypto = require('crypto');
const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');

// Required env vars for this payment finalizer:
// STRIPE_SECRET_KEY and DATABASE_URL for the paired checkout flow.
// STRIPE_WEBHOOK_SECRET is not currently consumed because this hub finalizes from success.html.

function pickCohost(cohosts, req){
  const zip = String(req.zip || '').trim();
  const city = String(req.city || '').trim().toLowerCase();
  const pool = cohosts.filter(c=>{
    if(c.status && c.status !== 'active') return false;
    if(zip && c.zip && String(c.zip).trim() === zip) return true;
    if(city && c.city && String(c.city).toLowerCase() === city) return true;
    return (!zip && !city);
  });
  return pool[0] || null;
}

exports.handler = async (event) => {
  try{
    await ensureSchema();

    const sessionId = (event.queryStringParameters?.session_id || '').trim();
    if(!sessionId) return { statusCode: 400, body: JSON.stringify({ok:false, error:'missing_session_id'}) };

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status !== 'paid'){
      return { statusCode: 200, body: JSON.stringify({ok:false, error:'not_paid'}) };
    }

    const requestId = session.metadata?.requestId;
    const requestType = session.metadata?.requestType || 'one_time';
    if(!requestId) return { statusCode: 400, body: JSON.stringify({ok:false, error:'missing_requestId'}) };

    const reqRes = await query(
      `
        SELECT id, host_uid, host_email, request_type, payload, quote, status, stay_id
        FROM host_requests
        WHERE id = $1
        LIMIT 1
      `,
      [requestId]
    );
    if(!reqRes.rowCount) return { statusCode: 404, body: JSON.stringify({ok:false, error:'request_not_found'}) };

    const req = reqRes.rows[0];
    const payload = req.payload || {};

    if(req.status === 'paid_confirmed' || req.status === 'stay_created'){
      return { statusCode: 200, body: JSON.stringify({ok:true, already:true, stayId: req.stay_id || null}) };
    }

    await query(
      `
        UPDATE host_requests
        SET status = 'paid_confirmed',
            paid_at = NOW(),
            updated_at = NOW(),
            stripe_session_id = $2,
            stripe_amount_total = $3,
            stripe_currency = $4
        WHERE id = $1
      `,
      [requestId, session.id, session.amount_total || null, session.currency || null]
    );

    const cRes = await query(
      `
        SELECT uid, email, name, city, zip, status
        FROM cohosts
        WHERE status = 'active'
      `
    ).catch(() => ({ rows: [] }));
    const cohosts = cRes.rows || [];
    const chosen = pickCohost(cohosts, payload);
    const stayId = crypto.randomUUID();

    const stayPayload = {
      hostUid: req.host_uid,
      hostName: payload.hostName || payload.contactName || '',
      hostEmail: req.host_email || '',
      cohostUid: chosen ? chosen.uid : null,
      cohostName: chosen ? (chosen.name || '') : '',
      listingName: payload.listingName || '',
      address: payload.address || '',
      city: payload.city || '',
      zip: payload.zip || '',
      startDate: payload.startDate || '',
      endDate: payload.endDate || '',
      turnoverDate: payload.turnoverDate || '',
      serviceType: payload.serviceType || 'turnover',
      addOns: payload.addOns || {},
      guestComms: payload.guestComms || 'no',
      notes: payload.notes || '',
      requestType: req.request_type || requestType,
      plan: payload.plan || 'none',
      quote: req.quote || null,
      status: chosen ? 'scheduled' : 'pending_assignment'
    };

    await query(
      `
        INSERT INTO stays (
          id, host_uid, host_name, host_email, cohost_uid, cohost_name,
          listing_name, address, city, zip, start_date, end_date, turnover_date,
          service_type, add_ons, guest_comms, notes, request_type, plan,
          quote, status, source_request_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15::jsonb, $16, $17, $18, $19,
          $20::jsonb, $21, $22, NOW(), NOW()
        )
      `,
      [
        stayId,
        stayPayload.hostUid,
        stayPayload.hostName,
        stayPayload.hostEmail,
        stayPayload.cohostUid,
        stayPayload.cohostName,
        stayPayload.listingName,
        stayPayload.address,
        stayPayload.city,
        stayPayload.zip,
        stayPayload.startDate,
        stayPayload.endDate,
        stayPayload.turnoverDate,
        stayPayload.serviceType,
        JSON.stringify(stayPayload.addOns || {}),
        stayPayload.guestComms,
        stayPayload.notes,
        stayPayload.requestType,
        stayPayload.plan,
        JSON.stringify(stayPayload.quote || {}),
        stayPayload.status,
        requestId
      ]
    );

    let subscriptionId = null;
    if(stayPayload.requestType === 'subscription' && stayPayload.plan && stayPayload.plan !== 'none'){
      subscriptionId = crypto.randomUUID();
      await query(
        `
          INSERT INTO subscriptions (id, host_uid, host_email, plan, status, started_at, latest_stay_id)
          VALUES ($1, $2, $3, $4, 'active', NOW(), $5)
        `,
        [subscriptionId, stayPayload.hostUid, stayPayload.hostEmail, stayPayload.plan, stayId]
      );

      await query(
        'UPDATE stays SET subscription_id = $2, updated_at = NOW() WHERE id = $1',
        [stayId, subscriptionId]
      );
    }

    await query(
      `
        UPDATE host_requests
        SET status = 'stay_created',
            updated_at = NOW(),
            stay_id = $2,
            cohost_uid = $3,
            cohost_name = $4,
            subscription_id = $5
        WHERE id = $1
      `,
      [requestId, stayId, chosen ? chosen.uid : null, chosen ? (chosen.name || '') : '', subscriptionId]
    );

    return { statusCode: 200, body: JSON.stringify({ok:true, stayId, cohostAssigned: !!chosen, subscriptionId}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
