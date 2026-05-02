import { apiClient } from '../lib/apiClient'

export const subcategoryService = {
  getAll: () => apiClient.get('/subcategories'),
  create: (data) => apiClient.post('/subcategories', data),
  update: (id, data) => apiClient.put(`/subcategories/${id}`, data),
}
