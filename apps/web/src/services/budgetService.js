import { apiClient } from '../lib/apiClient'

export const budgetService = {
  getByMonth: (month) => apiClient.get(`/budgets?month=${month}`),
  getSummary: (month, categoryId) =>
    apiClient.get(`/budgets/summary?month=${month}&category_id=${categoryId}`),
  create: (data) => apiClient.post('/budgets', data),
  update: (id, data) => apiClient.put(`/budgets/${id}`, data),
}
