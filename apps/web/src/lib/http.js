export async function readJsonResponse(response, fallbackMessage = 'Request failed') {
  const text = await response.text()
  let payload = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      if (!response.ok) {
        throw new Error(fallbackMessage)
      }
      throw new Error('Server returned invalid JSON')
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage)
  }

  return payload
}
