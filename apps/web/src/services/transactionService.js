import { apiClient } from '../lib/apiClient'

export const transactionService = {
  getByMonth: (month, type = '') => {
    const params = new URLSearchParams({ month })
    if (type) params.set('type', type)
    return apiClient.get(`/transactions?${params}`)
  },
  create: (data) => apiClient.post('/transactions', data),
  update: (id, data) => apiClient.put(`/transactions/${id}`, data),
  delete: (id) => apiClient.delete(`/transactions/${id}`),
}
