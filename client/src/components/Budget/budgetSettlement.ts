import type { BudgetItem } from '../../types'

export interface SettlementPerson {
  user_id: number
  username: string
  avatar_url: string | null
}

export interface SettlementBalance extends SettlementPerson {
  balance: number
}

export interface SettlementFlow {
  from: SettlementPerson
  to: SettlementPerson
  amount: number
}

export interface SettlementResult {
  balances: SettlementBalance[]
  flows: SettlementFlow[]
}

type MemberRow = {
  user_id: number
  paid: boolean
  username?: string
  avatar_url?: string | null
}

function resolveMember(
  m: MemberRow,
  fallback: Map<number, SettlementPerson>,
): SettlementPerson {
  const fb = fallback.get(m.user_id)
  return {
    user_id: m.user_id,
    username: m.username || fb?.username || `#${m.user_id}`,
    avatar_url: m.avatar_url ?? fb?.avatar_url ?? null,
  }
}

/**
 * Greedy debt matching — mirrors server calculateSettlement, with optional amount conversion.
 */
export function computeBudgetSettlement(
  items: BudgetItem[],
  tripMembers: Array<{ id: number; username: string; avatar_url?: string | null }>,
  convertAmount: (amount: number, item: BudgetItem) => number,
): SettlementResult {
  const memberLookup = new Map<number, SettlementPerson>(
    tripMembers.map(m => [m.id, { user_id: m.id, username: m.username, avatar_url: m.avatar_url ?? null }]),
  )

  const balances = new Map<number, SettlementBalance>()

  const ensure = (person: SettlementPerson) => {
    if (!balances.has(person.user_id)) {
      balances.set(person.user_id, { ...person, balance: 0 })
    }
    return balances.get(person.user_id)!
  }

  for (const item of items) {
    const members = (item.members || []) as MemberRow[]
    if (members.length === 0) continue

    const payers = members.filter(m => m.paid)
    if (payers.length === 0) continue

    const total = convertAmount(item.total_price || 0, item)
    if (total <= 0) continue

    const sharePerMember = total / members.length
    const paidPerPayer = total / payers.length

    for (const m of members) {
      const person = resolveMember(m, memberLookup)
      const row = ensure(person)
      row.balance -= sharePerMember
      if (m.paid) row.balance += paidPerPayer
    }
  }

  const rounded = Array.from(balances.values()).map(b => ({
    ...b,
    balance: Math.round(b.balance * 100) / 100,
  }))

  const people = rounded.filter(b => Math.abs(b.balance) > 0.01)
  const debtors = people.filter(p => p.balance < -0.01).map(p => ({ ...p, amount: -p.balance }))
  const creditors = people.filter(p => p.balance > 0.01).map(p => ({ ...p, amount: p.balance }))

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const flows: SettlementFlow[] = []
  let di = 0
  let ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const transfer = Math.min(debtors[di].amount, creditors[ci].amount)
    if (transfer > 0.01) {
      flows.push({
        from: debtors[di],
        to: creditors[ci],
        amount: Math.round(transfer * 100) / 100,
      })
    }
    debtors[di].amount -= transfer
    creditors[ci].amount -= transfer
    if (debtors[di].amount < 0.01) di++
    if (creditors[ci].amount < 0.01) ci++
  }

  return { balances: rounded, flows }
}

export function computePerPersonShares(
  items: BudgetItem[],
  convertAmount: (amount: number, item: BudgetItem) => number,
  tripMembers: Array<{ id: number; username: string; avatar_url?: string | null }>,
): Array<{ user_id: number; username: string; avatar_url: string | null; total_assigned: number }> {
  const lookup = new Map(tripMembers.map(m => [m.id, m]))
  const map = new Map<number, { user_id: number; username: string; avatar_url: string | null; total_assigned: number }>()

  for (const item of items) {
    const members = item.members || []
    if (members.length === 0) continue
    const total = convertAmount(item.total_price || 0, item)
    if (total <= 0) continue
    const share = total / members.length
    for (const m of members) {
      const tm = lookup.get(m.user_id)
      const existing = map.get(m.user_id)
      if (existing) existing.total_assigned += share
      else {
        map.set(m.user_id, {
          user_id: m.user_id,
          username: m.username || tm?.username || `#${m.user_id}`,
          avatar_url: m.avatar_url ?? tm?.avatar_url ?? null,
          total_assigned: share,
        })
      }
    }
  }

  return Array.from(map.values())
    .filter(p => p.total_assigned > 0.001)
    .sort((a, b) => b.total_assigned - a.total_assigned)
}
