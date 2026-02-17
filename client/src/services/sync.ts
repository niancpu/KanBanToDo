import type { OpLogEntry, SyncPushRequest, SyncResponse } from '@kanban/shared'
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
  private onRemoteOps: RemoteOpsHandler | null = null
  private disposed = false

  constructor() {
    // Device ID: persist in localStorage
    let deviceId = localStorage.getItem('sync_device_id')
    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem('sync_device_id', deviceId)
    }
    this.deviceId = deviceId

    // Restore clock
    this.clock = parseInt(localStorage.getItem('sync_clock') || '0', 10)
    this.lastSyncClock = parseInt(localStorage.getItem('sync_last_clock') || '0', 10)
  }

  setUserId(userId: string) {
    this.userId = userId
  }

  setOnRemoteOps(handler: RemoteOpsHandler) {
    this.onRemoteOps = handler
  }

  /** Record a local operation into opLog */
  async recordOp(op: { entityType: string; entityId: string; operation: SyncOperation; data?: unknown }) {
    this.clock++
    localStorage.setItem('sync_clock', String(this.clock))

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

    // Persist to IndexedDB
    const db = await getDB()
    await db.put('opLog', entry)

    this.pendingOps.push(entry)
    this.schedulePush()
  }

  /** Debounced push */
  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => this.push(), 500)
  }

  /** Push pending ops to server */
  async push(): Promise<void> {
    if (this.pendingOps.length === 0) return
    const ops = [...this.pendingOps]
    try {
      const req: SyncPushRequest = { operations: ops, lastSyncClock: this.lastSyncClock }
      const res = await api.post<SyncResponse>('/sync/push', req)
      this.lastSyncClock = res.serverClock
      localStorage.setItem('sync_last_clock', String(this.lastSyncClock))
      // Remove pushed ops
      this.pendingOps = this.pendingOps.filter((o) => !ops.includes(o))
    } catch (e) {
      console.error('Sync push failed, will retry:', e)
    }
  }

  /** Pull remote changes from server */
  async pull(): Promise<void> {
    try {
      const res = await api.post<SyncResponse>('/sync/pull', {
        lastSyncClock: this.lastSyncClock,
        deviceId: this.deviceId,
      })
      if (res.operations.length > 0) {
        // Filter out our own ops
        const remoteOps = res.operations.filter((o) => o.deviceId !== this.deviceId)
        if (remoteOps.length > 0 && this.onRemoteOps) {
          this.onRemoteOps(remoteOps)
        }
      }
      this.lastSyncClock = res.serverClock
      localStorage.setItem('sync_last_clock', String(this.lastSyncClock))
      // Update local clock to max
      if (res.serverClock > this.clock) {
        this.clock = res.serverClock
        localStorage.setItem('sync_clock', String(this.clock))
      }
    } catch (e) {
      console.error('Sync pull failed:', e)
    }
  }

  /** Connect WebSocket with JWT auth */
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

    this.socket.on('sync:update', (ops: OpLogEntry[]) => {
      if (this.disposed) return
      const remoteOps = ops.filter((o) => o.deviceId !== this.deviceId)
      if (remoteOps.length > 0 && this.onRemoteOps) {
        this.onRemoteOps(remoteOps)
      }
      const maxClock = Math.max(...ops.map((o) => o.clock), this.clock)
      if (maxClock > this.clock) {
        this.clock = maxClock
        localStorage.setItem('sync_clock', String(this.clock))
      }
    })

    this.socket.on('disconnect', () => {
      console.log('Sync WebSocket disconnected')
    })
  }

  disconnect() {
    this.disposed = true
    this.socket?.disconnect()
    this.socket = null
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
  }
}
