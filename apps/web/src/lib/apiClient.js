const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, { status = null, payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

class ApiClient {
  #token = null

  setToken(token) { this.#token = token }
  clearToken() { this.#token = null }
  getToken() { return this.#token }

  async request(method, path, body = null) {
    const headers = {}
    if (this.#token) headers.Authorization = `Bearer ${this.#token}`
    if (body !== null) headers['Content-Type'] = 'application/json'

    let res
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      throw new ApiError(err.message || 'Could not reach the server')
    }

    const text = await res.text()
    let data = null
    if (text) {
      try { data = JSON.parse(text) } catch { /* non-JSON body */ }
    }

    if (!res.ok) {
      throw new ApiError(data?.error || `${method} ${path} failed`, {
        status: res.status,
        payload: data,
      })
    }

    return data
  }

  get(path) { return this.request('GET', path) }
  post(path, body) { return this.request('POST', path, body) }
  put(path, body) { return this.request('PUT', path, body) }
  delete(path, body = null) { return this.request('DELETE', path, body) }
}

export const apiClient = new ApiClient()
