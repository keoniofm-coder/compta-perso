import { create } from 'zustand'
import { supabase } from './supabase'
import { COLLECTIONS, type CollectionName, type Collections, type DB, type Settings } from './types'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

type QueueOp =
  | { op: 'upsert'; id: string; collection: CollectionName; data: unknown; ts: number }
  | { op: 'delete'; id: string; ts: number }

export const LOCAL_USER = 'local'

const emptyDB = (): DB =>
  Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as DB

const cacheKey = (uid: string) => `trezo:cache:${uid}`
const queueKey = (uid: string) => `trezo:queue:${uid}`

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage plein ou bloqué */
  }
}

/** UUID déterministe : deux appareils qui créent le même mouvement automatique écrivent la même ligne. */
export function stableUuid(seed: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  const hex = [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0
        return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

interface DataState {
  userId: string | null
  loaded: boolean
  db: DB
  sync: SyncStatus
  pending: number
  lastSync: number
  open: (userId: string) => Promise<void>
  close: () => void
  refetch: () => Promise<void>
  put: <K extends CollectionName>(collection: K, item: Collections[K]) => void
  putMany: (items: { collection: CollectionName; item: { id: string } }[]) => void
  remove: (collection: CollectionName, id: string) => void
  removeMany: (items: { collection: CollectionName; id: string }[]) => void
  replaceAll: (db: DB) => void
}

let queue: QueueOp[] = []
let flushing = false
let retryTimer: ReturnType<typeof setTimeout> | undefined
let persistTimer: ReturnType<typeof setTimeout> | undefined
let flushRef: () => void = () => {}

export const useData = create<DataState>((set, get) => {
  const persist = () => {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const { userId, db } = get()
      if (userId) writeLS(cacheKey(userId), db)
    }, 250)
  }

  const saveQueue = () => {
    const { userId } = get()
    if (userId) writeLS(queueKey(userId), queue)
    set({ pending: queue.length })
  }

  const flush = async () => {
    const { userId } = get()
    if (!userId || userId === LOCAL_USER) {
      queue = []
      saveQueue()
      return
    }
    if (flushing || !queue.length) return
    flushing = true
    set({ sync: 'syncing' })
    const batch = [...queue]
    // On ne garde que la dernière opération par id.
    const last = new Map<string, QueueOp>()
    for (const op of batch) last.set(op.id, op)
    const upserts = [...last.values()].filter((o): o is Extract<QueueOp, { op: 'upsert' }> => o.op === 'upsert')
    const deletes = [...last.values()].filter((o) => o.op === 'delete').map((o) => o.id)
    try {
      for (let i = 0; i < upserts.length; i += 400) {
        const rows = upserts.slice(i, i + 400).map((o) => ({ id: o.id, user_id: userId, collection: o.collection, data: o.data }))
        const { error } = await supabase.from('records').upsert(rows)
        if (error) throw error
      }
      for (let i = 0; i < deletes.length; i += 200) {
        const { error } = await supabase.from('records').delete().in('id', deletes.slice(i, i + 200))
        if (error) throw error
      }
      const maxTs = Math.max(...batch.map((o) => o.ts))
      queue = queue.filter((o) => o.ts > maxTs)
      saveQueue()
      set({ sync: 'synced', lastSync: Date.now() })
      flushing = false
      if (queue.length) void flush()
    } catch (e) {
      flushing = false
      console.warn('Sync en attente', e)
      set({ sync: navigator.onLine ? 'error' : 'offline' })
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => void flush(), 8000)
    }
  }

  flushRef = () => void flush()

  const enqueue = (ops: QueueOp[]) => {
    queue.push(...ops)
    saveQueue()
    void flush()
  }

  const applyQueue = (db: DB) => {
    for (const op of queue) {
      if (op.op === 'upsert') {
        ;(db[op.collection] as Record<string, unknown>)[op.id] = op.data
      } else {
        for (const c of COLLECTIONS) delete (db[c] as Record<string, unknown>)[op.id]
      }
    }
    return db
  }

  const fetchAll = async (userId: string): Promise<DB> => {
    const db = emptyDB()
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from('records')
        .select('id, collection, data')
        .eq('user_id', userId)
        .order('id')
        .range(from, from + page - 1)
      if (error) throw error
      for (const row of data ?? []) {
        const col = row.collection as CollectionName
        if (db[col]) (db[col] as Record<string, unknown>)[row.id] = { ...(row.data as object), id: row.id }
      }
      if (!data || data.length < page) break
    }
    return db
  }

  return {
    userId: null,
    loaded: false,
    db: emptyDB(),
    sync: 'idle',
    pending: 0,
    lastSync: 0,

    open: async (userId) => {
      queue = readLS<QueueOp[]>(queueKey(userId), [])
      const cached = readLS<DB | null>(cacheKey(userId), null)
      const base = { ...emptyDB(), ...(cached ?? {}) }
      set({ userId, db: applyQueue(base), loaded: !!cached || userId === LOCAL_USER, pending: queue.length })
      if (userId === LOCAL_USER) {
        set({ loaded: true, sync: 'synced' })
        return
      }
      try {
        set({ sync: 'syncing' })
        const remote = await fetchAll(userId)
        if (get().userId !== userId) return
        set({ db: applyQueue(remote), loaded: true, sync: queue.length ? 'syncing' : 'synced', lastSync: Date.now() })
        persist()
        void flush()
      } catch (e) {
        console.warn('Chargement distant impossible', e)
        set({ loaded: true, sync: 'offline' })
      }
    },

    close: () => {
      queue = []
      set({ userId: null, db: emptyDB(), loaded: false, sync: 'idle', pending: 0 })
    },

    refetch: async () => {
      const { userId } = get()
      if (!userId || userId === LOCAL_USER || queue.length || flushing) return
      try {
        const remote = await fetchAll(userId)
        if (get().userId !== userId || queue.length) return
        set({ db: remote, sync: 'synced', lastSync: Date.now() })
        persist()
      } catch {
        set({ sync: 'offline' })
      }
    },

    put: (collection, item) => {
      const db = { ...get().db, [collection]: { ...get().db[collection], [item.id]: item } }
      set({ db })
      persist()
      enqueue([{ op: 'upsert', id: item.id, collection, data: item, ts: Date.now() + Math.random() }])
    },

    putMany: (items) => {
      if (!items.length) return
      const db = { ...get().db } as DB
      const touched = new Set<CollectionName>()
      for (const { collection } of items) touched.add(collection)
      for (const col of touched) (db as Record<string, unknown>)[col] = { ...db[col] }
      const now = Date.now()
      const ops: QueueOp[] = items.map(({ collection, item }, i) => {
        ;(db[collection] as Record<string, unknown>)[item.id] = item
        return { op: 'upsert', id: item.id, collection, data: item, ts: now + i / 1000 }
      })
      set({ db })
      persist()
      enqueue(ops)
    },

    remove: (collection, id) => {
      const next = { ...get().db[collection] }
      delete (next as Record<string, unknown>)[id]
      set({ db: { ...get().db, [collection]: next } })
      persist()
      enqueue([{ op: 'delete', id, ts: Date.now() + Math.random() }])
    },

    removeMany: (items) => {
      if (!items.length) return
      const db = { ...get().db } as DB
      const touched = new Set(items.map((i) => i.collection))
      for (const col of touched) (db as Record<string, unknown>)[col] = { ...db[col] }
      const now = Date.now()
      const ops: QueueOp[] = items.map(({ collection, id }, i) => {
        delete (db[collection] as Record<string, unknown>)[id]
        return { op: 'delete', id, ts: now + i / 1000 }
      })
      set({ db })
      persist()
      enqueue(ops)
    },

    replaceAll: (incoming) => {
      const current = get().db
      const delOps: { collection: CollectionName; id: string }[] = []
      for (const col of COLLECTIONS) for (const id of Object.keys(current[col])) delOps.push({ collection: col, id })
      get().removeMany(delOps)
      const puts: { collection: CollectionName; item: { id: string } }[] = []
      for (const col of COLLECTIONS) for (const item of Object.values(incoming[col] ?? {})) puts.push({ collection: col, item: item as { id: string } })
      get().putMany(puts)
    },
  }
})

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushRef())
  let lastFocus = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (queue.length) flushRef()
      else if (Date.now() - lastFocus > 60_000) void useData.getState().refetch()
    }
    lastFocus = Date.now()
  })
}

/* ---------------- Sélecteurs ---------------- */

export function useList<K extends CollectionName>(collection: K): Collections[K][] {
  const map = useData((s) => s.db[collection])
  return Object.values(map) as Collections[K][]
}

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = { baseCurrency: 'EUR' }

export function useSettings(): Settings {
  const map = useData((s) => s.db.settings)
  const first = Object.values(map)[0]
  return first ? { ...DEFAULT_SETTINGS, ...first } : { id: '', ...DEFAULT_SETTINGS }
}

export function saveSettings(patch: Partial<Settings>) {
  const st = useData.getState()
  const current = Object.values(st.db.settings)[0]
  const next: Settings = { ...DEFAULT_SETTINGS, ...(current ?? {}), ...patch, id: current?.id ?? uid() }
  st.put('settings', next)
}
