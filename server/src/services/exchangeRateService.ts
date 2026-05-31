export interface TryExchangeRates {
  source: 'tcmb' | 'exchangerate-api';
  date: string;
  fetchedAt: string;
  rates: { EUR: number; USD: number };
}

const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { data: TryExchangeRates; expiresAt: number } | null = null;

function parseTcmbForexBuying(xml: string, code: 'EUR' | 'USD'): number | null {
  const block = xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${code}"[\\s\\S]*?</Currency>`, 'i'));
  if (!block) return null;
  const unit = parseFloat(block[0].match(/<Unit>([\d.]+)<\/Unit>/)?.[1] || '1');
  const buying = parseFloat(block[0].match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)?.[1] || '');
  if (!Number.isFinite(buying) || !Number.isFinite(unit) || unit <= 0) return null;
  return buying / unit;
}

function parseTcmbDate(xml: string): string | null {
  const m = xml.match(/<Tarih_Date[^>]*Date="([^"]+)"/);
  return m?.[1] || null;
}

async function fetchFromTcmb(): Promise<TryExchangeRates | null> {
  const resp = await fetch(TCMB_URL, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const xml = await resp.text();
  const eur = parseTcmbForexBuying(xml, 'EUR');
  const usd = parseTcmbForexBuying(xml, 'USD');
  if (eur == null || usd == null) return null;
  const tcmbDate = parseTcmbDate(xml);
  return {
    source: 'tcmb',
    date: tcmbDate || new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: { EUR: eur, USD: usd },
  };
}

async function fetchFromExchangeRateApi(): Promise<TryExchangeRates | null> {
  const [eurResp, usdResp] = await Promise.all([
    fetch('https://api.exchangerate-api.com/v4/latest/EUR', { signal: AbortSignal.timeout(8000) }),
    fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(8000) }),
  ]);
  if (!eurResp.ok || !usdResp.ok) return null;
  const eurData = await eurResp.json() as { rates?: { TRY?: number }; date?: string };
  const usdData = await usdResp.json() as { rates?: { TRY?: number }; date?: string };
  const eur = eurData.rates?.TRY;
  const usd = usdData.rates?.TRY;
  if (eur == null || usd == null) return null;
  return {
    source: 'exchangerate-api',
    date: eurData.date || usdData.date || new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: { EUR: eur, USD: usd },
  };
}

export async function getTryExchangeRates(forceRefresh = false): Promise<TryExchangeRates> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }
  const tcmb = await fetchFromTcmb().catch(() => null);
  const data = tcmb || await fetchFromExchangeRateApi().catch(() => null);
  if (!data) throw new Error('Exchange rates unavailable');
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function clearExchangeRateCacheForTests(): void {
  cache = null;
}
