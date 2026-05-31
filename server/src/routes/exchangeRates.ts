import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getTryExchangeRates } from '../services/exchangeRateService';

const router = express.Router();

router.get('/try', authenticate, async (req: Request, res: Response) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getTryExchangeRates(refresh);
    res.json(data);
  } catch {
    res.status(503).json({ error: 'Exchange rates unavailable' });
  }
});

export default router;
