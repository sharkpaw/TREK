import { http, HttpResponse } from 'msw';

export const exchangeRatesHandlers = [
  http.get('/api/exchange-rates/try', () =>
    HttpResponse.json({
      source: 'tcmb',
      date: '25.05.2026',
      fetchedAt: new Date().toISOString(),
      rates: { EUR: 53.2181, USD: 45.7134 },
    }),
  ),
];
