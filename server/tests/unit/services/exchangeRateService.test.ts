import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

afterAll(() => vi.unstubAllGlobals());

import {
  getTryExchangeRates,
  clearExchangeRateCacheForTests,
} from '../../../src/services/exchangeRateService';

const TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Date="25.05.2026">
  <Currency CrossOrder="0" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit>
    <ForexBuying>53.2181</ForexBuying>
    <ForexSelling>53.2778</ForexSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <ForexBuying>45.7134</ForexBuying>
    <ForexSelling>45.7731</ForexSelling>
  </Currency>
</Tarih_Date>`;

describe('exchangeRateService', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    clearExchangeRateCacheForTests();
  });

  it('parses TCMB forex buying rates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => TCMB_XML,
    } as Response);

    const data = await getTryExchangeRates();
    expect(data.source).toBe('tcmb');
    expect(data.date).toBe('25.05.2026');
    expect(data.rates.EUR).toBeCloseTo(53.2181, 4);
    expect(data.rates.USD).toBeCloseTo(45.7134, 4);
  });

  it('falls back to exchangerate-api when TCMB fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: '2026-05-31', rates: { TRY: 53.5 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: '2026-05-31', rates: { TRY: 45.9 } }),
      } as Response);

    const data = await getTryExchangeRates();
    expect(data.source).toBe('exchangerate-api');
    expect(data.rates.EUR).toBe(53.5);
    expect(data.rates.USD).toBe(45.9);
  });

  it('returns cached rates without refetching', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => TCMB_XML,
    } as Response);

    await getTryExchangeRates();
    await getTryExchangeRates();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when forceRefresh is true', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => TCMB_XML,
    } as Response);

    await getTryExchangeRates();
    await getTryExchangeRates(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when all sources fail', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(getTryExchangeRates()).rejects.toThrow('Exchange rates unavailable');
  });
});
