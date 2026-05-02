import { offlineDb } from './db'
import { apiClient } from '../lib/apiClient'

function serializeQueuePayload(payload) {
  return {
    ...payload,
    amount: Number(payload.amount),
  }
}

async function markQueueItem(queueId, patch) {
  const existing = await offlineDb.syncQueue.get(queueId)
  if (!existing) return
  await offlineDb.syncQueue.put({ ...existing, ...patch })
}

async function removeQueueItem(queueId) {
  await offlineDb.syncQueue.delete(queueId)
}

async function markTransactionSynced(localId, serverRecord) {
  const existing = await offlineDb.transactions.get(localId)
  if (!existing) return

  await offlineDb.transactions.put({
    ...existing,
    ...serverRecord,
    id: localId,
    serverId: serverRecord.id,
    client_uuid: serverRecord.client_uuid || existing.client_uuid,
    syncStatus: 'synced',
    localOnly: false,
    updatedAtServer: serverRecord.updated_at || new Date().toISOString(),
    monthKey: (serverRecord.transaction_date || existing.transaction_date || '').slice(0, 7),
  })
}

export async function syncPendingTransactionCreates() {
  const queueItems = await offlineDb.syncQueue
    .where('status')
    .equals('pending')
    .toArray()

  const createItems = queueItems
    .filter(item => item.entityType === 'transaction' && item.action === 'create')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))

  const results = { synced: 0, failed: 0 }

  for (const item of createItems) {
    await markQueueItem(item.id, {
      status: 'syncing',
      lastAttemptAt: new Date().toISOString(),
      attemptCount: (item.attemptCount || 0) + 1,
      errorMessage: null,
    })

    try {
      const payload = await apiClient.post('/transactions', serializeQueuePayload(item.payload))
      await markTransactionSynced(item.entityId, payload)
      await removeQueueItem(item.id)
      results.synced += 1
    } catch (error) {
      await markQueueItem(item.id, {
        status: 'failed',
        errorMessage: error.message || 'Sync failed',
      })
      results.failed += 1
    }
  }

  return results
}

export async function getSyncQueueCounts() {
  const pending = await offlineDb.syncQueue.where('status').equals('pending').count()
  const syncing = await offlineDb.syncQueue.where('status').equals('syncing').count()
  const failed  = await offlineDb.syncQueue.where('status').equals('failed').count()
  return { pending, syncing, failed }
}

export async function retryFailedSyncQueueItems() {
  const failedItems = await offlineDb.syncQueue.where('status').equals('failed').toArray()
  await Promise.all(
    failedItems.map(item => markQueueItem(item.id, { status: 'pending', errorMessage: null }))
  )
  return failedItems.length
}
