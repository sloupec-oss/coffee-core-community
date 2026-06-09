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

  await Promise.all([
    notifyOrganizer({ bookingId, name, email, phone, sess, paymentMethod }),
    notifyCustomer({ bookingId, name, email, sess, isEn }),
  ]);

  res.status(200).json({
    ok: true,
    bookingId,
    session: { time: sess.time, instructor: sess.instructor },
  });
};

async function sendEmail({ to, subject, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('EMAIL (no Resend key):', { to, subject });
    return;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Coffee Core Community <onboarding@resend.dev>',
        to: [to],
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error('Resend error:', e.message);
  }
}

async function notifyCustomer({ bookingId, name, email, sess, isEn }) {
  const subject = isEn
    ? `Booking confirmed — Coffee, Core & Community ${sess.time}`
    : `Rezervace potvrzena — Coffee, Core & Community ${sess.time}`;

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

  await sendEmail({ to: email, subject, text });
}

async function notifyOrganizer({ bookingId, name, email, phone, sess, paymentMethod }) {
  const organizer = process.env.ORGANIZER_EMAIL;
  if (!organizer) return;

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

  await sendEmail({ to: organizer, subject, text });
}
