import { useState, useEffect, useCallback } from 'react'
import { exchangeRatesApi } from '../api/client'

export interface TryRates {
  EUR: number
  USD: number
}

export function convertAmountToTry(amount: number, currency: string, rates: TryRates | null): number {
  if (!rates || currency === 'TRY') return amount
  if (currency === 'EUR') return amount * rates.EUR
  if (currency === 'USD') return amount * rates.USD
  return amount
}

export function useTryExchangeRates(enabled: boolean) {
  const [rates, setRates] = useState<TryRates | null>(null)
  const [meta, setMeta] = useState<{ source: string; date: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadRates = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(false)
    try {
      const data = await exchangeRatesApi.tryRates(refresh)
      setRates(data.rates)
      setMeta({ source: data.source, date: data.date })
    } catch {
      setRates(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) loadRates()
  }, [enabled, loadRates])

  return { rates, meta, loading, error, refresh: () => loadRates(true) }
}
