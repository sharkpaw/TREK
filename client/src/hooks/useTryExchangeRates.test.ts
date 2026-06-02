import { describe, it, expect } from 'vitest'
import { computeGrandTotalTry, convertAmountToTry } from './useTryExchangeRates'

const rates = { EUR: 53.2181, USD: 45.7134 }

describe('computeGrandTotalTry', () => {
  it('sums TRY amounts and converts foreign currencies', () => {
    const totals = new Map([
      ['TRY', 30827],
      ['EUR', 18],
      ['USD', 509.94],
    ])
    const total = computeGrandTotalTry(totals, rates)
    expect(total).toBeCloseTo(
      30827 + 18 * rates.EUR + 509.94 * rates.USD,
      2,
    )
  })
})

describe('convertAmountToTry', () => {
  it('passes through TRY unchanged', () => {
    expect(convertAmountToTry(100, 'TRY', rates)).toBe(100)
  })
})
