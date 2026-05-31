import { budgetApi } from '../api/client'
import { offlineDb, upsertBudgetItems } from '../db/offlineDb'
import type { BudgetItem } from '../types'
import type { BudgetCategoryMeta } from '../types'

export const budgetRepo = {
  async list(tripId: number | string): Promise<{ items: BudgetItem[]; categories?: BudgetCategoryMeta[] }> {
    if (!navigator.onLine) {
      const cached = await offlineDb.budgetItems
        .where('trip_id')
        .equals(Number(tripId))
        .toArray()
      return { items: cached }
    }
    const result = await budgetApi.list(tripId)
    upsertBudgetItems(result.items)
    return result
  },
}
