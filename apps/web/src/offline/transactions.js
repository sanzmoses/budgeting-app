import { v4 as uuidv4 } from 'uuid'
import { offlineDb } from './db'

offlineDb.version(2).stores({
  meta: '&key',
  bootstrapCache: '&key, syncedAt',
  transactions: '&id, transactionDate, type, syncStatus, monthKey',
  syncQueue: '&id, status, entityType, entityId, createdAt',
})

function monthKeyFromDate(value) {
  return value ? value.slice(0, 7) : new Date().toISOString().slice(0, 7)
}

export async function queueOfflineTransactionCreate(payload) {
  const id = uuidv4()
  const queueId = uuidv4()
  const createdAt = new Date().toISOString()

  const localTransaction = {
    id,
    client_uuid: id,
    localOnly: true,
    syncStatus: 'pending_create',
    createdAtLocal: createdAt,
    updatedAtLocal: createdAt,
    monthKey: monthKeyFromDate(payload.transaction_date),
    ...payload,
  }

  const queuePayload = {
    ...payload,
    client_uuid: id,
  }

  const queueItem = {
    id: queueId,
    entityType: 'transaction',
    entityId: id,
    action: 'create',
    payload: queuePayload,
    status: 'pending',
    attemptCount: 0,
    createdAt,
    lastAttemptAt: null,
    errorMessage: null,
  }

  await offlineDb.transaction('rw', offlineDb.transactions, offlineDb.syncQueue, async () => {
    await offlineDb.transactions.put(localTransaction)
    await offlineDb.syncQueue.put(queueItem)
  })

  return localTransaction
}

export async function getOfflineTransactionsByMonth(month, filterType = '') {
  const rows = await offlineDb.transactions
    .where('monthKey')
    .equals(month)
    .toArray()

  return rows
    .filter(row => !filterType || row.type === filterType)
    .sort((a, b) => {
      const dateCmp = String(b.transaction_date).localeCompare(String(a.transaction_date))
      if (dateCmp !== 0) return dateCmp
      return String(b.createdAtLocal || '').localeCompare(String(a.createdAtLocal || ''))
    })
}

export async function getPendingSyncCount() {
  return offlineDb.syncQueue.where('status').equals('pending').count()
}
