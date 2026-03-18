import { authLogin, authMe, authSignup, createCheckout, createRequest } from './hub-api.js';

const $ = (id) => document.getElementById(id);

function toast(el, msg, kind = '') {
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

let currentUser = null;

const authCard = $('authCard');
const mainCard = $('mainCard');
const authStatus = $('authStatus');
const reqStatus = $('reqStatus');
const quoteBox = $('quoteBox');
const form = $('reqForm');
const payBtn = $('payBtn');

function friendlyCheckoutError(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  if (raw.includes('stripe_secret_key') || raw.includes('api key')) {
    return 'Checkout is temporarily unavailable because Stripe is not configured on this hub. Your request was saved, but payment could not start.';
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return 'We could not reach Stripe checkout right now. Your request was saved; please try again in a minute.';
  }
  return 'We could not start Stripe checkout right now. Your request was saved; please try again shortly.';
}

const BASE = {
  express: { sedan: 55, suv: 70, truck: 80, van: 85, luxury: 110 },
  standard: { sedan: 140, suv: 165, truck: 185, van: 195, luxury: 260 },
  premium: { sedan: 220, suv: 260, truck: 290, van: 310, luxury: 420 },
};

const SUBS = {
  spark: { label: 'SPARK', price: 189, includes: '1x/mo Standard (1 vehicle)', visitsPerMonth: 1, level: 'standard' },
  glow: { label: 'GLOW', price: 329, includes: '2x/mo Standard (1 vehicle)', visitsPerMonth: 2, level: 'standard' },
  obsidian: { label: 'OBSIDIAN', price: 299, includes: '4x/mo Express (1 vehicle)', visitsPerMonth: 4, level: 'express' },
};

const ADDONS = { engine: 35, headlights: 55, odor: 65, heavySoilPct: 0.20, interiorOffPct: 0.18, extraVehiclePct: 0.85 };

function getData() {
  const fd = new FormData(form);
  const obj = {};
  for (const [key, value] of fd.entries()) obj[key] = value;
  return obj;
}

function money(value) {
  return '$' + (Math.round(value * 100) / 100).toFixed(2);
}

function calcQuote(data) {
  const vehicleType = data.vehicleType;
  const serviceLevel = data.serviceLevel;
  const vehicleCount = parseInt(data.vehicleCount || '1', 10) || 1;
  const interior = data.interior === 'yes';
  const heavy = data.heavySoil === 'yes';
  const isSubscription = data.requestType === 'subscription' && data.plan && data.plan !== 'none';

  let subtotal = 0;
  const items = [];

  if (isSubscription) {
    const plan = SUBS[data.plan];
    subtotal = plan.price;
    items.push({ label: `Subscription: ${plan.label}`, amount: plan.price });
    items.push({ label: 'Includes', amount: 0, note: plan.includes });
    if (vehicleCount > 1) {
      const basePer = BASE[plan.level][vehicleType] || 0;
      const extra = (vehicleCount - 1) * basePer * ADDONS.extraVehiclePct;
      subtotal += extra;
      items.push({ label: `Extra vehicles (${vehicleCount - 1})`, amount: extra });
    }
  } else {
    const basePer = (BASE[serviceLevel] || {})[vehicleType] || 0;
    const base = basePer * vehicleCount;
    subtotal = base;
    items.push({ label: `Base (${serviceLevel}, ${vehicleType}) x${vehicleCount}`, amount: base });
  }

  if (!interior) {
    const off = subtotal * ADDONS.interiorOffPct;
    subtotal -= off;
    items.push({ label: 'Exterior-only discount', amount: -off });
  }
  if (heavy) {
    const extra = subtotal * ADDONS.heavySoilPct;
    subtotal += extra;
    items.push({ label: 'Heavy soil / pet hair handling', amount: extra });
  }
  if (data.engine === 'yes') {
    subtotal += ADDONS.engine;
    items.push({ label: 'Add-on: Engine bay', amount: ADDONS.engine });
  }
  if (data.headlights === 'yes') {
    subtotal += ADDONS.headlights;
    items.push({ label: 'Add-on: Headlight restore', amount: ADDONS.headlights });
  }
  if (data.odor === 'yes') {
    subtotal += ADDONS.odor;
    items.push({ label: 'Add-on: Odor treatment', amount: ADDONS.odor });
  }

  return { subtotal, items, isSubscription, plan: isSubscription ? data.plan : null };
}

function renderQuote() {
  const data = getData();
  const quote = calcQuote(data);
  quoteBox.innerHTML = '';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({
    requestType: data.requestType,
    plan: data.plan,
    estimatedSubtotal: money(quote.subtotal),
    breakdown: quote.items.map((item) => ({ label: item.label, amount: money(item.amount) })),
  }, null, 2);
  quoteBox.appendChild(pre);
  return quote;
}

form?.addEventListener('input', renderQuote);
form?.addEventListener('change', renderQuote);

function draftKey() {
  return 'sol_detail_request_draft_v2';
}

$('saveReqBtn')?.addEventListener('click', () => {
  localStorage.setItem(draftKey(), JSON.stringify({ data: getData(), savedAt: new Date().toISOString() }));
  toast(reqStatus, 'Draft saved on this device.', 'ok');
});

$('loadReqBtn')?.addEventListener('click', () => {
  const raw = localStorage.getItem(draftKey());
  if (!raw) {
    toast(reqStatus, 'No draft found.', 'bad');
    return;
  }
  const parsed = JSON.parse(raw);
  const data = parsed.data || {};
  Object.entries(data).forEach(([key, value]) => {
    const element = form.querySelector(`[name="${CSS.escape(key)}"]`);
    if (element) element.value = value;
  });
  renderQuote();
  toast(reqStatus, 'Draft loaded.', 'ok');
});

$('signInBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('pass').value;
  if (!email || !password) {
    toast(authStatus, 'Enter email + password.', 'bad');
    return;
  }
  try {
    const data = await authLogin(email, password);
    currentUser = data.user || null;
    toast(authStatus, 'Signed in', 'ok');
    syncAuthUI();
  } catch (error) {
    toast(authStatus, 'Sign-in failed: ' + (error.message || error), 'bad');
  }
});

$('signUpBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('pass').value;
  if (!email || !password) {
    toast(authStatus, 'Enter email + password.', 'bad');
    return;
  }
  try {
    const data = await authSignup(email, password, email.split('@')[0], 'client');
    currentUser = data.user || null;
    toast(authStatus, 'Account created', 'ok');
    syncAuthUI();
  } catch (error) {
    toast(authStatus, 'Sign-up failed: ' + (error.message || error), 'bad');
  }
});

payBtn?.addEventListener('click', async () => {
  toast(reqStatus, '', '');
  if (!form.checkValidity()) {
    form.reportValidity();
    toast(reqStatus, 'Missing required fields.', 'bad');
    return;
  }
  if (!currentUser) {
    toast(reqStatus, 'Sign in first.', 'bad');
    return;
  }

  const data = getData();
  const quote = calcQuote(data);
  payBtn.disabled = true;

  try {
    toast(reqStatus, 'Creating request…');
    const request = await createRequest({
      clientUid: currentUser.id,
      clientEmail: currentUser.email || null,
      requestType: data.requestType || 'one_time',
      payload: data,
      quote,
    });
    toast(reqStatus, 'Redirecting to payment…');
    const checkout = await createCheckout({ requestId: request.requestId, clientUid: currentUser.id });
    if (!checkout.url) throw new Error('missing_checkout_url');
    window.location.href = checkout.url;
  } catch (error) {
    console.error(error);
    toast(reqStatus, friendlyCheckoutError(error), 'bad');
  } finally {
    payBtn.disabled = false;
  }
});

function syncAuthUI() {
  if (!currentUser) {
    authCard.style.display = 'block';
    mainCard.style.display = 'none';
    return;
  }
  authCard.style.display = 'none';
  mainCard.style.display = 'block';
  renderQuote();
}

authMe().then((data) => {
  currentUser = data.user || null;
  syncAuthUI();
}).catch(() => {
  currentUser = null;
  syncAuthUI();
});
