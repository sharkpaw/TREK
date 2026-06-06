import { describe, it, expect } from 'vitest'
import { computeBudgetSettlement, computePerPersonShares } from './budgetSettlement'
import type { BudgetItem } from '../../types'

const members = [
  { id: 1, username: 'alice', avatar_url: null },
  { id: 2, username: 'bob', avatar_url: null },
  { id: 3, username: 'carol', avatar_url: null },
]

function item(id: number, total: number, itemMembers: BudgetItem['members']): BudgetItem {
  return {
    id,
    trip_id: 1,
    name: `Item ${id}`,
    total_price: total,
    currency: 'EUR',
    category: 'Food',
    paid_by: null,
    persons: itemMembers.length,
    members: itemMembers,
    expense_date: null,
  }
}

describe('computeBudgetSettlement', () => {
  it('1 payer 10k for 5 people: others owe payer their share', () => {
    const items = [
      item(1, 10000, [
        { user_id: 1, paid: true, username: 'alice' },
        { user_id: 2, paid: false, username: 'bob' },
        { user_id: 3, paid: false, username: 'carol' },
        { user_id: 4, paid: false, username: 'dave' },
        { user_id: 5, paid: false, username: 'eve' },
      ]),
    ]
    const tripMembers = [
      ...members,
      { id: 4, username: 'dave', avatar_url: null },
      { id: 5, username: 'eve', avatar_url: null },
    ]
    const { balances, flows } = computeBudgetSettlement(items, tripMembers, (a) => a)

    const alice = balances.find(b => b.user_id === 1)!
    expect(alice.balance).toBe(8000)
    expect(flows).toHaveLength(4)
    expect(flows.every(f => f.to.user_id === 1)).toBe(true)
    expect(flows.every(f => f.amount === 2000)).toBe(true)
  })

  it('multiple payers on same item split credit', () => {
    const items = [
      item(1, 100, [
        { user_id: 1, paid: true, username: 'alice' },
        { user_id: 2, paid: true, username: 'bob' },
        { user_id: 3, paid: false, username: 'carol' },
      ]),
    ]
    const { balances } = computeBudgetSettlement(items, members, (a) => a)
    expect(balances.find(b => b.user_id === 1)!.balance).toBeCloseTo(16.67, 1)
    expect(balances.find(b => b.user_id === 3)!.balance).toBeCloseTo(-33.33, 1)
  })
})

describe('computePerPersonShares', () => {
  it('sums per-item shares, not equal grand total split', () => {
    const items = [
      item(1, 6000, [
        { user_id: 1, paid: true, username: 'alice' },
        { user_id: 2, paid: false, username: 'bob' },
      ]),
      item(2, 4000, [
        { user_id: 1, paid: false, username: 'alice' },
        { user_id: 2, paid: false, username: 'bob' },
      ]),
    ]
    const shares = computePerPersonShares(items, (a) => a, members)
    const alice = shares.find(p => p.user_id === 1)!
    const bob = shares.find(p => p.user_id === 2)!
    expect(alice.total_assigned).toBe(5000)
    expect(bob.total_assigned).toBe(5000)
  })
})
