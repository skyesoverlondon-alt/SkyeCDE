const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST"){
      return { statusCode: 405, body: JSON.stringify({ok:false, error:"method_not_allowed"}) };
    }
    const siteUrl = process.env.SITE_URL || process.env.URL || "http://localhost:8888";
    const body = JSON.parse(event.body || "{}");
    const requestId = (body.requestId || "").trim();
    const hostUid = (body.hostUid || "").trim();
    const requestType = (body.requestType || "one_time").trim();
    const quoteSubtotal = Number(body.quoteSubtotal || 0);

    if(!requestId || !hostUid){
      return { statusCode: 400, body: JSON.stringify({ok:false, error:"missing_fields"}) };
    }

    // - One-time turnover: deposit 25% (min $59, max $175)
    // - Subscription: first month up front (min $149)
    let amountCents = 0;
    let label = "SkyeHubs — Turnover Deposit";

    if(requestType === "subscription"){
      const month = Math.max(14900, Math.round(quoteSubtotal * 100));
      amountCents = month;
      label = "SkyeHubs — Co-Host Subscription Start (First Month)";
    }else{
      const dep = quoteSubtotal ? (quoteSubtotal * 0.25) : 99;
      const depClamped = Math.min(175, Math.max(59, dep));
      amountCents = Math.round(depClamped * 100);
      label = "SkyeHubs — Co-Host Service Deposit";
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
      metadata: { requestId, hostUid, requestType }
    });

    return { statusCode: 200, body: JSON.stringify({ok:true, url: session.url}) };
  }catch(e){
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ok:false, error: e.message || String(e)}) };
  }
};
