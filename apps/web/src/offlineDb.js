import Dexie from 'dexie'

export const offlineDb = new Dexie('budgeting-app')

offlineDb.version(1).stores({
  meta: '&key',
  bootstrapCache: '&key, syncedAt',
})

export async function saveBootstrapCache(payload) {
  const syncedAt = new Date().toISOString()

  await offlineDb.transaction('rw', offlineDb.bootstrapCache, offlineDb.meta, async () => {
    await offlineDb.bootstrapCache.put({
      key: 'bootstrap',
      payload,
      syncedAt,
    })

    await offlineDb.meta.put({
      key: 'lastBootstrapSyncAt',
      value: syncedAt,
    })
  })

  return syncedAt
}

export async function getBootstrapCache() {
  return offlineDb.bootstrapCache.get('bootstrap')
}

export async function getLastBootstrapSyncAt() {
  const row = await offlineDb.meta.get('lastBootstrapSyncAt')
  return row?.value || null
}
