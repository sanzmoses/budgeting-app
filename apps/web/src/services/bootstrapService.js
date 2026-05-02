import { apiClient } from '../lib/apiClient'

export const bootstrapService = {
  get: () => apiClient.get('/bootstrap'),
}
