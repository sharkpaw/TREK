import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import type { TryRates } from '../../hooks/useTryExchangeRates'
import { convertAmountToTry, computeGrandTotalTry } from '../../hooks/useTryExchangeRates'
import { currencyDecimals } from '../../utils/formatters'

const SYMBOLS: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$' }

interface BudgetTryConversionProps {
  totalsByCurrency: Map<string, number>
  locale: string
  theme: {
    bg: string
    border: string
    text: string
    sub: string
    faint: string
    divider: string
    iconBg: string
    iconBorder: string
    rowHover: string
    shadow: string
  }
  t: (key: string, params?: Record<string, string | number>) => string
  rates: TryRates | null
  meta: { source: string; date: string } | null
  loading: boolean
  error: boolean
  onRefresh: () => void
}

function fmtAmount(v: number, locale: string, cur: string) {
  const d = currencyDecimals(cur)
  return Number(v).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ' + (SYMBOLS[cur] || cur)
}

function fmtPlain(v: number, locale: string, cur: string) {
  const d = currencyDecimals(cur)
  return Number(v).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function BudgetTryConversion({
  totalsByCurrency, locale, theme, t, rates, meta, loading, error, onRefresh,
}: BudgetTryConversionProps) {
  const tryAmount = totalsByCurrency.get('TRY') || 0
  const eurAmount = totalsByCurrency.get('EUR') || 0
  const usdAmount = totalsByCurrency.get('USD') || 0
  const hasForeign = eurAmount > 0 || usdAmount > 0

  const rows = useMemo(() => {
    if (!rates) return null
    const eurTry = convertAmountToTry(eurAmount, 'EUR', rates)
    const usdTry = convertAmountToTry(usdAmount, 'USD', rates)
    const grandTotal = computeGrandTotalTry(totalsByCurrency, rates)
    return {
      eurTry,
      usdTry,
      grandTotal,
      eurRate: rates.EUR,
      usdRate: rates.USD,
    }
  }, [rates, tryAmount, eurAmount, usdAmount])

  if (!hasForeign) return null

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    alignItems: 'baseline',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.divider}`,
    fontSize: 12,
  } as const

  return (
    <div style={{
      marginTop: 16,
      paddingTop: 16,
      borderTop: `1px solid ${theme.divider}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('budget.tryConversionTitle')}
          </div>
          <div style={{ fontSize: 11, color: theme.sub, marginTop: 2 }}>
            {t('budget.tryConversionSubtitle')}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title={t('budget.refreshRates')}
          style={{
            background: theme.iconBg,
            border: `1px solid ${theme.iconBorder}`,
            borderRadius: 8,
            padding: 6,
            cursor: loading ? 'default' : 'pointer',
            color: theme.sub,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>{t('budget.ratesUnavailable')}</p>
      )}

      {rows && (
        <>
          <div style={rowStyle}>
            <span style={{ color: theme.text, fontWeight: 500 }}>{t('budget.currencyTRY')}</span>
            <span style={{ color: theme.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(tryAmount, locale, 'TRY')}</span>
          </div>

          {eurAmount > 0 && (
            <div style={rowStyle}>
              <div>
                <div style={{ color: theme.text, fontWeight: 500 }}>{t('budget.currencyEUR')}</div>
                <div style={{ fontSize: 10, color: theme.faint, marginTop: 2 }}>
                  {fmtAmount(eurAmount, locale, 'EUR')} · 1 EUR = {rows.eurRate.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ₺
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: theme.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(rows.eurTry, locale, 'TRY')}</div>
                <div style={{ fontSize: 10, color: theme.faint, marginTop: 2 }}>
                  ({fmtPlain(eurAmount, locale, 'EUR')} × {rows.eurRate.toLocaleString(locale, { maximumFractionDigits: 4 })} ₺)
                </div>
              </div>
            </div>
          )}

          {usdAmount > 0 && (
            <div style={rowStyle}>
              <div>
                <div style={{ color: theme.text, fontWeight: 500 }}>{t('budget.currencyUSD')}</div>
                <div style={{ fontSize: 10, color: theme.faint, marginTop: 2 }}>
                  {fmtAmount(usdAmount, locale, 'USD')} · 1 USD = {rows.usdRate.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ₺
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: theme.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtAmount(rows.usdTry, locale, 'TRY')}</div>
                <div style={{ fontSize: 10, color: theme.faint, marginTop: 2 }}>
                  ({fmtPlain(usdAmount, locale, 'USD')} × {rows.usdRate.toLocaleString(locale, { maximumFractionDigits: 4 })} ₺)
                </div>
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '12px 0 4px',
            marginTop: 4,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{t('budget.grandTotalTry')}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {fmtAmount(rows.grandTotal, locale, 'TRY')}
            </span>
          </div>
        </>
      )}

      {meta && rows && (
        <p style={{ fontSize: 10, color: theme.faint, margin: '10px 0 0', lineHeight: 1.4 }}>
          {t('budget.ratesFootnote', {
            source: meta.source === 'tcmb' ? 'TCMB' : 'ExchangeRate-API',
            date: meta.date,
          })}
        </p>
      )}
    </div>
  )
}
