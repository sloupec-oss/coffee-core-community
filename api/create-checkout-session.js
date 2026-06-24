const Stripe = require('stripe');

const SESSIONS = {
  s3: { time: '9:00–9:50',   instructor: 'Ela', langCs: 'Česká lekce',    langEn: 'Czech class',    dateCs: '27. 6. 2026', dateEn: 'June 27, 2026',  eventFile: 'event.html' },
  s1: { time: '10:30–11:20', instructor: 'Ivy', langCs: 'Anglická lekce', langEn: 'English class',  dateCs: '27. 6. 2026', dateEn: 'June 27, 2026',  eventFile: 'event.html' },
  s4: { time: '9:00–9:50',   instructor: 'Ivy', langCs: 'Anglická lekce', langEn: 'English class',  dateCs: '11. 7. 2026', dateEn: 'July 11, 2026',  eventFile: 'event-july.html' },
  s2: { time: '10:30–11:20', instructor: 'Ela', langCs: 'Česká lekce',    langEn: 'Czech class',    dateCs: '11. 7. 2026', dateEn: 'July 11, 2026',  eventFile: 'event-july.html' },
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { sessionId, name, email, phone, mat, lang } = req.body;

  if (!sessionId || !name || !email || !SESSIONS[sessionId]) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const sess = SESSIONS[sessionId];
  const langLabel = lang === 'en' ? sess.langEn : sess.langCs;
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: email,
    locale: lang === 'en' ? 'en' : 'cs',
    line_items: [
      {
        price_data: {
          currency: 'czk',
          product_data: {
            name: `Core, Coffee & Community — ${sess.time}`,
            description: `${langLabel} · s ${sess.instructor} · Arnoldova Vila, Brno · ${sess.dateCs}`,
            images: [`${baseUrl}/assets/hero-bg.jpg`],
          },
          unit_amount: 35000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${baseUrl}/${sess.eventFile}?success=true&sid=${sessionId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
    cancel_url: `${baseUrl}/${sess.eventFile}?cancel=true`,
    metadata: {
      sessionId,
      sessionTime: sess.time,
      instructor: sess.instructor,
      langLabel,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || '',
      mat: mat || 'own',
    },
    payment_intent_data: {
      metadata: {
        sessionId,
        instructor: sess.instructor,
        customerName: name,
      },
    },
  });

  res.status(200).json({ url: checkoutSession.url });
};
