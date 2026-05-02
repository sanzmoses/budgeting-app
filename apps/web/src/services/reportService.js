import { apiClient } from '../lib/apiClient'

export const reportService = {
  getSummary: (params) => apiClient.get(`/reports/summary?${params}`),
  getCategoryBreakdown: (params) => apiClient.get(`/reports/category-breakdown?${params}`),
}
