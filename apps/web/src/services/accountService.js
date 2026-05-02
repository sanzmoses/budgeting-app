import { apiClient } from '../lib/apiClient'

export const accountService = {
  getAll: () => apiClient.get('/accounts'),
  getBalances: () => apiClient.get('/accounts/balances'),
  create: (data) => apiClient.post('/accounts', data),
  update: (id, data) => apiClient.put(`/accounts/${id}`, data),
  delete: (id, confirmation) => apiClient.delete(`/accounts/${id}`, { confirmation }),
}
