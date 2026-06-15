const Stripe = require('stripe');
const nodemailer = require('nodemailer');

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
  s3: { time: '9:00–9:50',   instructor: 'Ela', langLabel: 'Česká / Czech class' },
  s1: { time: '10:30–11:20', instructor: 'Ivy', langLabel: 'Anglická / English class' },
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
    await notifyCustomer({
      name: meta.customerName,
      email: meta.customerEmail,
      sess,
      sessionId: meta.sessionId,
      bookingId: `CCC-${session.payment_intent?.slice(-10).toUpperCase()}`,
    });
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

async function notifyCustomer({ name, email, sess, sessionId, bookingId }) {
  if (!email) return;
  const isEn = sessionId === 's1';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.ORGANIZER_EMAIL, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const subject = isEn
    ? `Booking confirmed — Core, Coffee & Community`
    : `Rezervace potvrzena — Core, Coffee & Community`;

  const text = isEn
    ? `Hi ${name},

your spot is confirmed! 🌿 We can't wait to see you.

Session details:
📅 Saturday, June 27, 2026
⏰ ${sess.time} — ${sess.langLabel}
👩‍🏫 Instructor: ${sess.instructor}
📍 Arnoldova Vila, Drobného 299/26, Brno
💳 Payment: Paid online via card
🔖 Booking ID: ${bookingId}

What to bring:
Comfortable clothes and a yoga mat. A drink from Cecilie Café is included 🌿
No mat? No problem — just email us at pilatesarnoldovavila@gmail.com and we'll sort one out for you.

Cancellations:
Free cancellation up to 24 hours before the session. Full refund guaranteed.
Email us at: pilatesarnoldovavila@gmail.com

See you soon!
Ivy & Ela
Coffee, Core & Community — Arnoldova Vila`
    : `Ahoj ${name},

tvoje místo je rezervované! 🌿 Těšíme se na tebe.

Detaily lekce:
📅 Sobota 27. června 2026
⏰ ${sess.time} — ${sess.langLabel}
👩‍🏫 Instruktorka: ${sess.instructor}
📍 Arnoldova Vila, Drobného 299/26, Brno
💳 Platba: Zaplaceno online kartou
🔖 ID rezervace: ${bookingId}

Co si přinést:
Pohodlné oblečení a podložku na cvičení. Drink od Cecilie Café je součástí ceny 🌿
Nemáš podložku na cvičení? Napiš nám předem na pilatesarnoldovavila@gmail.com a rádi ti ji zapůjčíme.

Zrušení rezervace:
Rezervaci lze zrušit zdarma nejpozději 24 hodin předem. Platbu vrátíme v plné výši.
Piš na: pilatesarnoldovavila@gmail.com

Těšíme se na tebe!
Ivy & Ela
Coffee, Core & Community — Arnoldova Vila`;

  try {
    await transporter.sendMail({
      from: `Core, Coffee & Community <${process.env.ORGANIZER_EMAIL}>`,
      to: email,
      subject,
      text,
    });
    console.log(`Customer confirmation sent → ${email}`);
  } catch (e) {
    console.error('Customer email error:', e.message);
  }
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
