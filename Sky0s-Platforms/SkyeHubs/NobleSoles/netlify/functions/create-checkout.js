const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a Stripe Checkout Session for a booking request.
 * Expects JSON body: { requestId, clientUid }
 */
exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST"){
      return { statusCode: 405, body: JSON.stringify({ok:false, error:"method_not_allowed"}) };
    }
    const siteUrl = process.env.SITE_URL || process.env.URL || "http://localhost:8888";
    const body = JSON.parse(event.body || "{}");
    const requestId = (body.requestId || "").trim();
    const clientUid = (body.clientUid || "").trim();
    if(!requestId || !clientUid){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_fields"}) };
    }

    // NOTE: Amount is computed server-side in finalize-checkout using Firestore quote.
    // MVP approach: charge a standardized deposit now (e.g. $50) then finalize later.
    // If you want full amount, finalize-checkout can adjust, but best practice is compute here from Firestore.
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

    return { statusCode: 200, body: JSON.stringify({ok:true, url: session.url}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
