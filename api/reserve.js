// Handles cash + QR reservations (no Stripe payment)
// Sends email notification to organizer via fetch to a simple mailto fallback.
// Uses Resend if RESEND_API_KEY is set, otherwise logs only.

const SESSIONS = {
  s1: { time: '10:00–10:50', instructor: 'Ivy', langLabel: 'Anglická / English class' },
  s2: { time: '13:30–14:20', instructor: 'Ela', langLabel: 'Česká / Czech class' },
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { sessionId, name, email, phone, paymentMethod } = req.body;

  if (!sessionId || !name || !email || !SESSIONS[sessionId]) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const sess = SESSIONS[sessionId];
  const bookingId = `CCC-${Date.now()}`;

  await notifyOrganizer({ bookingId, name, email, phone, sess, paymentMethod });

  res.status(200).json({
    ok: true,
    bookingId,
    session: { time: sess.time, instructor: sess.instructor },
  });
};

async function notifyOrganizer({ bookingId, name, email, phone, sess, paymentMethod }) {
  const organizer = process.env.ORGANIZER_EMAIL;
  if (!organizer) return;

  const payLabel = paymentMethod === 'qr' ? 'QR platba' : 'Hotově na místě';
  const subject = `Nová rezervace CCC — ${sess.time} (${sess.instructor})`;
  const body = `Nová rezervace bez online platby:

Jméno: ${name}
Email: ${email}
Telefon: ${phone || '—'}
Lekce: ${sess.time} — ${sess.langLabel}
Instruktorka: ${sess.instructor}
Platba: ${payLabel}
Rezervace ID: ${bookingId}
Čas: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}

Zkontrolujte platbu před lekcí.`;

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Coffee Core Community <onboarding@resend.dev>',
          to: [organizer],
          subject,
          text: body,
        }),
      });
    } catch (e) {
      console.error('Resend error:', e.message);
    }
  } else {
    console.log('ORGANIZER NOTIFICATION (no Resend key):', { subject, body });
  }
}
