import type {
  OpLogEntry,
  SyncPushRequest,
  SyncResponse,
  SyncSnapshotResponse,
} from '@kanban/shared'
import { SyncOperation } from '@kanban/shared'
import { io, type Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import { api } from './api'
import { getDB } from '@/db'

type RemoteOpsHandler = (ops: OpLogEntry[]) => void

export class SyncEngine {
  private pendingOps: OpLogEntry[] = []
  private lastSyncClock = 0
  private clock = 0
  private deviceId: string
  private userId = ''
  private socket: Socket | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pushRetryCount = 0
  private onRemoteOps: RemoteOpsHandler | null = null
  private disposed = false

  constructor() {
    let deviceId = localStorage.getItem('sync_device_id')
    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem('sync_device_id', deviceId)
    }
    this.deviceId = deviceId
  }

  private clockKey() {
    return `sync_clock:${this.userId}`
  }

  private lastClockKey() {
    return `sync_last_clock:${this.userId}`
  }

  private loadUserClocks() {
    const userClock = localStorage.getItem(this.clockKey())
    const userLastClock = localStorage.getItem(this.lastClockKey())
    const legacyClock = localStorage.getItem('sync_clock')
    const legacyLastClock = localStorage.getItem('sync_last_clock')
    this.clock = parseInt(userClock ?? legacyClock ?? '0', 10)
    this.lastSyncClock = parseInt(userLastClock ?? legacyLastClock ?? '0', 10)
    this.saveClock()
    this.saveLastSyncClock()
    if (legacyClock !== null) localStorage.removeItem('sync_clock')
    if (legacyLastClock !== null) localStorage.removeItem('sync_last_clock')
  }

  private saveClock() {
    localStorage.setItem(this.clockKey(), String(this.clock))
  }

  private saveLastSyncClock() {
    localStorage.setItem(this.lastClockKey(), String(this.lastSyncClock))
  }

  setUserId(userId: string) {
    this.userId = userId
    this.loadUserClocks()
  }

  async hydratePendingOps() {
    if (!this.userId) return
    const db = await getDB()
    const all = await db.getAll('opLog')
    this.pendingOps = all
      .filter((op) => op.userId === this.userId && op.clock > this.lastSyncClock)
      .sort((a, b) => a.clock - b.clock)
  }

  setOnRemoteOps(handler: RemoteOpsHandler) {
    this.onRemoteOps = handler
  }

  async recordOp(op: { entityType: string; entityId: string; operation: SyncOperation; data?: unknown }) {
    this.clock++
    this.saveClock()

    const entry: OpLogEntry = {
      id: uuidv4(),
      userId: this.userId,
      deviceId: this.deviceId,
      entityType: op.entityType,
      entityId: op.entityId,
      operation: op.operation,
      data: op.data,
      clock: this.clock,
      timestamp: new Date().toISOString(),
    }

    const db = await getDB()
    await db.put('opLog', entry)

    this.pendingOps.push(entry)
    this.schedulePush()
  }

  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    const delay = this.pushRetryCount > 0
      ? Math.min(500 * Math.pow(2, this.pushRetryCount), 30000)
      : 500
    this.pushTimer = setTimeout(() => this.push(), delay)
  }

  async push(): Promise<void> {
    if (this.pendingOps.length === 0) return
    const ops = [...this.pendingOps]
    try {
      const req: SyncPushRequest = { operations: ops, lastSyncClock: this.lastSyncClock }
      const res = await api.post<SyncResponse>('/sync/push', req)
      this.lastSyncClock = res.serverClock
      this.saveLastSyncClock()
      this.pendingOps = this.pendingOps.filter((o) => !ops.includes(o))
      this.pushRetryCount = 0
      await this.pruneAckedOps()
    } catch (e) {
      console.error('Sync push failed, will retry:', e)
      this.pushRetryCount++
      this.schedulePush()
    }
  }

  async pull(): Promise<void> {
    try {
      const res = await api.post<SyncResponse>('/sync/pull', {
        lastSyncClock: this.lastSyncClock,
        deviceId: this.deviceId,
      })
      if (res.operations.length > 0) {
        const remoteOps = res.operations.filter((o) => o.deviceId !== this.deviceId)
        if (remoteOps.length > 0 && this.onRemoteOps) {
          this.onRemoteOps(remoteOps)
        }
      }
      this.lastSyncClock = res.serverClock
      this.saveLastSyncClock()
      if (res.serverClock > this.clock) {
        this.clock = res.serverClock
        this.saveClock()
      }
      await this.pruneAckedOps()
    } catch (e) {
      console.error('Sync pull failed:', e)
    }
  }

  async snapshot() {
    return api.post<SyncSnapshotResponse>('/sync/snapshot', {})
  }

  private async pruneAckedOps() {
    if (!this.userId) return
    const db = await getDB()
    const all = await db.getAll('opLog')
    const tx = db.transaction('opLog', 'readwrite')
    for (const op of all) {
      if (op.userId === this.userId && op.clock <= this.lastSyncClock) {
        tx.store.delete(op.id)
      }
    }
    await tx.done
  }

  connect(url: string, token: string) {
    if (this.socket?.connected) return
    this.disposed = false

    this.socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    this.socket.on('connect', () => {
      if (this.disposed) return
      console.log('Sync WebSocket connected')
      this.pull()
    })

    this.socket.on('connect_error', (err: Error) => {
      const msg = err.message?.toLowerCase() || ''
      if (msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('token') || msg.includes('forbidden')) {
        console.warn('Sync WebSocket auth failed, stopping reconnection:', err.message)
        this.disconnect()
      }
    })

    this.socket.on('sync:update', (ops: OpLogEntry[]) => {
      if (this.disposed) return
      const remoteOps = ops.filter((o) => o.deviceId !== this.deviceId)
      if (remoteOps.length > 0 && this.onRemoteOps) {
        this.onRemoteOps(remoteOps)
      }
      const maxClock = Math.max(...ops.map((o) => o.clock), this.clock)
      if (maxClock > this.clock) {
        this.clock = maxClock
        this.saveClock()
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Sync WebSocket disconnected:', reason)
      if (this.disposed || reason === 'io server disconnect') {
        this.socket?.disconnect()
      }
    })
  }

  disconnect() {
    this.disposed = true
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
  }
}
