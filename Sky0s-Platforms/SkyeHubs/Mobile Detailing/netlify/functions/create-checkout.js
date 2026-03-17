const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST"){
      return { statusCode: 405, body: JSON.stringify({ok:false, error:"method_not_allowed"}) };
    }
    const siteUrl = process.env.SITE_URL || process.env.URL || "http://localhost:8888";
    const body = JSON.parse(event.body || "{}");
    const requestId = (body.requestId || "").trim();
    const clientUid = (body.clientUid || "").trim();
    const requestType = (body.requestType || "one_time").trim();
    const quoteSubtotal = Number(body.quoteSubtotal || 0);

    if(!requestId || !clientUid){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_fields"}) };
    }

    // Pricing strategy:
    // - One-time: collect a deposit (25% of quote, min $49, max $150) to lock the slot.
    // - Subscription: collect first month up front (quoteSubtotal is the monthly estimate).
    let amountCents = 0;
    let label = "SOL Detailing — Deposit";
    if(requestType === "subscription"){
      const month = Math.max(99, Math.round(quoteSubtotal * 100)); // min $0.99 placeholder guard
      amountCents = Math.max(9900, month); // min $99 subscription start
      label = "SOL Detailing — Subscription Start (First Month)";
    }else{
      const dep = quoteSubtotal ? (quoteSubtotal * 0.25) : 75;
      const depClamped = Math.min(150, Math.max(49, dep));
      amountCents = Math.round(depClamped * 100);
      label = "SOL Detailing — Appointment Deposit";
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: amountCents
        },
        quantity: 1
      }],
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      metadata: { requestId, clientUid, requestType }
    });

    return { statusCode: 200, body: JSON.stringify({ok:true, url: session.url}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
