const Stripe = require('stripe');

const SESSIONS = {
  s3: {
    time: '9:00–9:50',
    instructor: 'Ela',
    langCs: 'Česká lekce',
    langEn: 'Czech class',
  },
  s1: {
    time: '10:30–11:20',
    instructor: 'Ivy',
    langCs: 'Anglická lekce',
    langEn: 'English class',
  },
  s2: {
    time: '16:00–16:50',
    instructor: 'Ela',
    langCs: 'Česká lekce',
    langEn: 'Czech class',
  },
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

  const { sessionId, name, email, phone, lang } = req.body;

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
            description: `${langLabel} · s ${sess.instructor} · Arnoldova Vila, Brno · 27. 6. 2026`,
            images: [`${baseUrl}/assets/hero-bg.jpg`],
          },
          unit_amount: 35000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${baseUrl}/event.html?success=true&sid=${sessionId}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
    cancel_url: `${baseUrl}/event.html?cancel=true`,
    metadata: {
      sessionId,
      sessionTime: sess.time,
      instructor: sess.instructor,
      langLabel,
      customerName: name,
      customerEmail: email,
      customerPhone: phone || '',
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
