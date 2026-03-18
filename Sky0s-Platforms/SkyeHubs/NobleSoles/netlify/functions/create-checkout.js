function getStripe(){
  if(!process.env.STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY env var");
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');

// Required env vars for this checkout initializer:
// STRIPE_SECRET_KEY, DATABASE_URL, SITE_URL or URL, and DEFAULT_DEPOSIT_CENTS if you want a custom deposit.
// STRIPE_WEBHOOK_SECRET is not currently consumed because this hub finalizes from success.html.

/**
 * Creates a Stripe Checkout Session for a booking request.
 * Expects JSON body: { requestId, clientUid }
 */
exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST"){
      return { statusCode: 405, body: JSON.stringify({ok:false, error:"method_not_allowed"}) };
    }
    const stripe = getStripe();
    await ensureSchema();
    const siteUrl = process.env.SITE_URL || process.env.URL || "http://localhost:8888";
    const body = JSON.parse(event.body || "{}");
    const requestId = (body.requestId || "").trim();
    const clientUid = (body.clientUid || "").trim();
    if(!requestId || !clientUid){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_fields"}) };
    }

    const existing = await query('SELECT id FROM booking_requests WHERE id = $1 AND client_uid = $2 LIMIT 1', [requestId, clientUid]);
    if(!existing.rowCount){
      return { statusCode: 404, body: JSON.stringify({ok:false, error:"request_not_found"}) };
    }

    // MVP approach: charge a standardized deposit now, then finalize the stay assignment after payment.
    const depositCents = parseInt(process.env.DEFAULT_DEPOSIT_CENTS || "5000", 10);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Noble Soul — Booking Request Deposit" },
          unit_amount: depositCents
        },
        quantity: 1
      }],
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      metadata: {
        requestId,
        clientUid
      }
    });

    await query('UPDATE booking_requests SET updated_at = NOW(), stripe_session_id = $2 WHERE id = $1', [requestId, session.id]);

    return { statusCode: 200, body: JSON.stringify({ok:true, url: session.url}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
