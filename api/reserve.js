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
  s2: { time: '14:00–15:00', instructor: 'Ela', langLabel: 'Česká / Czech class' },
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
  const isEn = lang === 'en';

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
    ? `Booking confirmed — Core, Coffee & Community ${sess.time}`
    : `Rezervace potvrzena — Core, Coffee & Community ${sess.time}`;

  const text = isEn
    ? `Hi ${name},

Your spot is reserved! See you on June 27 at Arnoldova Vila.

Session: ${sess.time} — ${sess.langLabel}
Instructor: ${sess.instructor}
Payment: Cash on site (please bring 350 Kč)
Booking ID: ${bookingId}

Address: Drobného 299/26, 602 00 Brno-sever-Černá Pole

See you there,
Ivy & Ela`
    : `Ahoj ${name},

Tvoje místo je rezervované! Těšíme se na tebe 27. června v Arnoldově vile.

Lekce: ${sess.time} — ${sess.langLabel}
Instruktorka: ${sess.instructor}
Platba: Hotově na místě (přines prosím 350 Kč)
Rezervace ID: ${bookingId}

Adresa: Drobného 299/26, 602 00 Brno-sever-Černá Pole

Těšíme se,
Ivy & Ela`;

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
