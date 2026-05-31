import { budgetApi } from '../../api/client'
import { budgetRepo } from '../../repo/budgetRepo'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type { BudgetItem, BudgetMember, BudgetCategoryMeta } from '../../types'
import { getApiErrorMessage } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

function categoriesToMap(categories: BudgetCategoryMeta[] = []): Record<string, string> {
  return Object.fromEntries(categories.map(c => [c.category, c.currency]))
}

export interface BudgetSlice {
  budgetCategories: Record<string, string>
  loadBudgetItems: (tripId: number | string) => Promise<void>
  addBudgetItem: (tripId: number | string, data: Partial<BudgetItem>) => Promise<BudgetItem>
  updateBudgetItem: (tripId: number | string, id: number, data: Partial<BudgetItem>) => Promise<BudgetItem>
  deleteBudgetItem: (tripId: number | string, id: number) => Promise<void>
  setBudgetItemMembers: (tripId: number | string, itemId: number, userIds: number[]) => Promise<{ members: BudgetMember[]; item: BudgetItem }>
  toggleBudgetMemberPaid: (tripId: number | string, itemId: number, userId: number, paid: boolean) => Promise<void>
  reorderBudgetItems: (tripId: number | string, orderedIds: number[]) => Promise<void>
  reorderBudgetCategories: (tripId: number | string, orderedCategories: string[]) => Promise<void>
  updateBudgetCategoryCurrency: (tripId: number | string, category: string, currency: string) => Promise<void>
  renameBudgetCategory: (tripId: number | string, oldName: string, newName: string) => Promise<void>
}

export const createBudgetSlice = (set: SetState, get: GetState): BudgetSlice => ({
  budgetCategories: {},

  loadBudgetItems: async (tripId) => {
    try {
      const data = await budgetRepo.list(tripId)
      set({
        budgetItems: data.items,
        budgetCategories: categoriesToMap(data.categories),
      })
    } catch (err: unknown) {
      console.error('Failed to load budget items:', err)
    }
  },

  addBudgetItem: async (tripId, data) => {
    try {
      const result = await budgetApi.create(tripId, data)
      set(state => ({
        budgetItems: [...state.budgetItems, result.item],
        budgetCategories: data.category && !state.budgetCategories[data.category]
          ? { ...state.budgetCategories, [data.category]: state.budgetCategories[data.category] || 'EUR' }
          : state.budgetCategories,
      }))
      return result.item
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error adding budget item'))
    }
  },

  updateBudgetItem: async (tripId, id, data) => {
    const prevItems = get().budgetItems
    if (data.currency !== undefined) {
      set(state => ({
        budgetItems: state.budgetItems.map(item =>
          item.id === id ? { ...item, currency: data.currency } : item
        ),
      }))
    }
    try {
      const result = await budgetApi.update(tripId, id, data)
      set(state => ({
        budgetItems: state.budgetItems.map(item => item.id === id ? result.item : item)
      }))
      if (result.item.reservation_id && data.total_price !== undefined) {
        get().loadReservations(tripId)
      }
      return result.item
    } catch (err: unknown) {
      if (data.currency !== undefined) set({ budgetItems: prevItems })
      throw new Error(getApiErrorMessage(err, 'Error updating budget item'))
    }
  },

  deleteBudgetItem: async (tripId, id) => {
    const prev = get().budgetItems
    set(state => ({ budgetItems: state.budgetItems.filter(item => item.id !== id) }))
    try {
      await budgetApi.delete(tripId, id)
    } catch (err: unknown) {
      set({ budgetItems: prev })
      throw new Error(getApiErrorMessage(err, 'Error deleting budget item'))
    }
  },

  setBudgetItemMembers: async (tripId, itemId, userIds) => {
    const result = await budgetApi.setMembers(tripId, itemId, userIds);
    set(state => ({
      budgetItems: state.budgetItems.map(item =>
        item.id === itemId ? { ...item, members: result.members, persons: result.item.persons } : item
      )
    }));
    return result;
  },

  toggleBudgetMemberPaid: async (tripId, itemId, userId, paid) => {
    await budgetApi.togglePaid(tripId, itemId, userId, paid);
    set(state => ({
      budgetItems: state.budgetItems.map(item =>
        item.id === itemId
          ? { ...item, members: (item.members || []).map(m => m.user_id === userId ? { ...m, paid } : m) }
          : item
      )
    }));
  },

  reorderBudgetItems: async (tripId, orderedIds) => {
    // Optimistic: reorder locally
    set(state => {
      const byId = new Map(state.budgetItems.map(i => [i.id, i]))
      const reordered = orderedIds.map((id, idx) => {
        const item = byId.get(id)
        return item ? { ...item, sort_order: idx } : null
      }).filter((i): i is BudgetItem => i !== null)
      // Keep items not in orderedIds at the end
      const remaining = state.budgetItems.filter(i => !orderedIds.includes(i.id))
      return { budgetItems: [...reordered, ...remaining] }
    })
    try {
      await budgetApi.reorderItems(tripId, orderedIds)
    } catch {
      // Reload on failure
      const data = await budgetApi.list(tripId)
      set({ budgetItems: data.items, budgetCategories: categoriesToMap(data.categories) })
    }
  },

  reorderBudgetCategories: async (tripId, orderedCategories) => {
    // Optimistic: reorder items by new category order (Map preserves insertion order for numeric keys)
    set(state => {
      const grouped = new Map<string, BudgetItem[]>()
      for (const item of state.budgetItems) {
        const cat = item.category || 'Other'
        if (!grouped.has(cat)) grouped.set(cat, [])
        grouped.get(cat)!.push(item)
      }
      const reordered: BudgetItem[] = []
      for (const cat of orderedCategories) {
        const items = grouped.get(cat)
        if (items) reordered.push(...items)
      }
      for (const [cat, items] of grouped) {
        if (!orderedCategories.includes(cat)) reordered.push(...items)
      }
      return { budgetItems: reordered }
    })
    try {
      await budgetApi.reorderCategories(tripId, orderedCategories)
    } catch {
      const data = await budgetApi.list(tripId)
      set({ budgetItems: data.items, budgetCategories: categoriesToMap(data.categories) })
    }
  },

  updateBudgetCategoryCurrency: async (tripId, category, currency) => {
    set(state => ({
      budgetCategories: { ...state.budgetCategories, [category]: currency },
    }))
    try {
      await budgetApi.updateCategoryCurrency(tripId, category, currency)
    } catch {
      const data = await budgetApi.list(tripId)
      set({ budgetItems: data.items, budgetCategories: categoriesToMap(data.categories) })
    }
  },

  renameBudgetCategory: async (tripId, oldName, newName) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    set(state => {
      const next = { ...state.budgetCategories }
      if (next[oldName] !== undefined) {
        next[trimmed] = next[oldName]
        delete next[oldName]
      }
      return {
        budgetCategories: next,
        budgetItems: state.budgetItems.map(item =>
          item.category === oldName ? { ...item, category: trimmed } : item
        ),
      }
    })
    try {
      await budgetApi.renameCategory(tripId, oldName, trimmed)
    } catch {
      const data = await budgetApi.list(tripId)
      set({ budgetItems: data.items, budgetCategories: categoriesToMap(data.categories) })
    }
  },
})
