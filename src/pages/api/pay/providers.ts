import { NextApiRequest, NextApiResponse } from 'next';
import { PAYMENT_PACKS, providerStatus } from '../../../lib/payments/core';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.json({ packs: PAYMENT_PACKS, providers: providerStatus() });
}
