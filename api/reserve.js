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
  s1: { time: '10:30–11:30', instructor: 'Ivy', langLabel: 'Anglická / English class' },
  s2: { time: '16:00–17:00', instructor: 'Ela', langLabel: 'Česká / Czech class' },
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { sessionId, name, email, phone, paymentMethod, lang } = req.body;

  if (!sessionId || !name || !email || !SESSIONS[sessionId]) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const sess = SESSIONS[sessionId];
  const bookingId = `CCC-${Date.now()}`;
  const isEn = sessionId === 's1'; // Ivy's class is always English, Ela's always Czech

  await notifyCustomer({ bookingId, name, email, sess, isEn });
  await notifyOrganizer({ bookingId, name, email, phone, sess });
  await decrementSpot(sessionId);

  res.status(200).json({
    ok: true,
    bookingId,
    session: { time: sess.time, instructor: sess.instructor },
  });
};

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ORGANIZER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function notifyCustomer({ bookingId, name, email, sess, isEn }) {
  const transporter = getTransporter();
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
💳 Payment: Cash on site — please bring 350 Kč
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
💳 Platba: Hotově na místě — přines prosím 350 Kč
🔖 ID rezervace: ${bookingId}

Co si přinést:
Pohodlné oblečení a podložku na cvičení na cvičení. Drink od Cecilie Café je součástí ceny 🌿
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
    console.log(`Customer email sent → ${email}`);
  } catch (e) {
    console.error('Customer email error:', e.message);
  }
}

async function notifyOrganizer({ bookingId, name, email, phone, sess }) {
  const organizer = process.env.ORGANIZER_EMAIL;
  if (!organizer) return;

  const transporter = getTransporter();
  const subject = `Nová rezervace CCC — ${sess.time} (${sess.instructor})`;
  const text = `Nová rezervace bez online platby:

Jméno: ${name}
Email: ${email}
Telefon: ${phone || '—'}
Lekce: ${sess.time} — ${sess.langLabel}
Instruktorka: ${sess.instructor}
Platba: Hotově na místě
Rezervace ID: ${bookingId}
Čas: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}

Zkontrolujte platbu před lekcí.`;

  try {
    await transporter.sendMail({
      from: `Core, Coffee & Community <${organizer}>`,
      to: organizer,
      subject,
      text,
    });
    console.log(`Organizer email sent → ${organizer}`);
  } catch (e) {
    console.error('Organizer email error:', e.message);
  }
}
