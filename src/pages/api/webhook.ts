import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const rawBody = await getRawBody(req);
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    
    // Verify signature
    if (secret) {
      const sig = req.headers['x-signature'] as string;
      const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (sig !== hmac) return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    const eventName = event.meta?.event_name;
    const attrs = event.data?.attributes;
    const email = attrs?.user_email || attrs?.customer_email;
    const variantName = attrs?.variant_name || attrs?.product_name || '';

    if (!email) return res.status(400).json({ error: 'No email in event' });

    // Handle different events
    if (eventName === 'order_created' || eventName === 'subscription_created') {
      if (variantName.includes('PRO') || variantName.includes('Monthly')) {
        // Upgrade to PRO
        const user = await kv.hget('users', email) as any;
        if (user) {
          user.plan = 'pro';
          await kv.hset('users', { [email]: user });
        }
      }
      
      // Add credits for one-time packs
      const creditsMap: Record<string, number> = { '5': 5, '20': 20, '50': 50 };
      for (const [key, amount] of Object.entries(creditsMap)) {
        if (variantName.includes(key)) {
          const creditsKey = `credits:${email}`;
          const current = (await kv.get<number>(creditsKey)) || 0;
          await kv.set(creditsKey, current + amount);
          break;
        }
      }
    }

    console.log(`Webhook processed: ${eventName} for ${email} — ${variantName}`);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
