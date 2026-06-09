const Stripe = require('stripe');

async function decrementSpot(sessionId) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['DECR', `spots:${sessionId}`]]),
  });
}

const SESSIONS = {
  s1: { time: '10:30–11:30', instructor: 'Ivy', langLabel: 'Anglická / English class' },
  s2: { time: '14:00–15:00', instructor: 'Ela', langLabel: 'Česká / Czech class' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const sess = SESSIONS[meta.sessionId] || { time: '?', instructor: '?', langLabel: '?' };

    await decrementSpot(meta.sessionId);
    await notifyOrganizer({
      name: meta.customerName,
      email: meta.customerEmail,
      phone: meta.customerPhone,
      sess,
      paymentId: session.payment_intent,
      amountPaid: (session.amount_total / 100).toFixed(0),
    });
  }

  res.status(200).json({ received: true });
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function notifyOrganizer({ name, email, phone, sess, paymentId, amountPaid }) {
  const organizer = process.env.ORGANIZER_EMAIL;
  if (!organizer) return;

  const subject = `✅ Platba přijata — ${sess.time} (${sess.instructor})`;
  const body = `Nová potvrzená rezervace (Stripe platba):

Jméno: ${name || '—'}
Email: ${email || '—'}
Telefon: ${phone || '—'}
Lekce: ${sess.time} — ${sess.langLabel}
Instruktorka: ${sess.instructor}
Zaplaceno: ${amountPaid} Kč
Stripe Payment ID: ${paymentId}
Čas: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}`;

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Core, Coffee & Community <onboarding@resend.dev>',
          to: [organizer],
          subject,
          text: body,
        }),
      });
    } catch (e) {
      console.error('Resend error:', e.message);
    }
  } else {
    console.log('ORGANIZER NOTIFICATION:', { subject, body });
  }
}
