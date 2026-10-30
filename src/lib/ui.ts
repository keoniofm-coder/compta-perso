import { create } from 'zustand'
import type { Transaction } from './types'

export type ModalSpec =
  | { type: 'tx'; kind?: Transaction['kind']; tx?: Transaction; accountId?: string; scope?: 'perso' | 'pro'; preset?: Partial<Transaction> }
  | { type: 'split'; accountId?: string }
  | { type: 'account'; id?: string; preset?: { type?: string } }
  | { type: 'checkpoint'; accountId: string; month?: string; txId?: string }
  | { type: 'recurring'; id?: string; preset?: Record<string, unknown> }
  | { type: 'validate'; recurringId: string; month: string }
  | { type: 'holding'; id?: string; accountId?: string }
  | { type: 'op'; holdingId: string; id?: string; kind?: string }
  | { type: 'asset'; id?: string; preset?: Record<string, unknown> }
  | { type: 'liability'; id?: string }
  | { type: 'employee'; id?: string }

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

interface ConfirmSpec {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

const PRIVACY_KEY = 'trezo:privacy'
const THEME_KEY = 'trezo:theme'

export type ThemeMode = 'auto' | 'light' | 'dark'

interface UIState {
  modals: ModalSpec[]
  toasts: Toast[]
  confirmSpec: ConfirmSpec | null
  privacy: boolean
  theme: ThemeMode
  isDark: boolean
  open: (m: ModalSpec) => void
  closeTop: () => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
  setPrivacy: (v: boolean) => void
  setTheme: (t: ThemeMode) => void
  setConfirm: (c: ConfirmSpec | null) => void
}

const readTheme = (): ThemeMode => {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'auto'
  } catch {
    return 'auto'
  }
}

const systemDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

const applyTheme = (t: ThemeMode) => {
  const dark = t === 'dark' || (t === 'auto' && systemDark())
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', dark ? '#0b1020' : '#f5f6fb')
  return dark
}

let toastSeq = 1

export const useUI = create<UIState>((set, get) => {
  const theme = readTheme()
  let privacy = false
  try {
    privacy = localStorage.getItem(PRIVACY_KEY) === '1'
  } catch {
    /* ignore */
  }
  return {
    modals: [],
    toasts: [],
    confirmSpec: null,
    privacy,
    theme,
    isDark: typeof document !== 'undefined' ? applyTheme(theme) : false,
    open: (m) => set({ modals: [...get().modals, m] }),
    closeTop: () => set({ modals: get().modals.slice(0, -1) }),
    toast: (message, tone = 'success') => {
      const id = toastSeq++
      set({ toasts: [...get().toasts, { id, message, tone }] })
      setTimeout(() => get().dismiss(id), 3800)
    },
    dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    setPrivacy: (v) => {
      try {
        localStorage.setItem(PRIVACY_KEY, v ? '1' : '0')
      } catch {
        /* ignore */
      }
      set({ privacy: v })
    },
    setTheme: (t) => {
      try {
        localStorage.setItem(THEME_KEY, t)
      } catch {
        /* ignore */
      }
      set({ theme: t, isDark: applyTheme(t) })
    },
    setConfirm: (c) => set({ confirmSpec: c }),
  }
})

if (typeof window !== 'undefined' && typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useUI.getState()
    if (theme === 'auto') useUI.setState({ isDark: applyTheme('auto') })
  })
}

export const openModal = (m: ModalSpec) => useUI.getState().open(m)
export const toast = (message: string, tone?: Toast['tone']) => useUI.getState().toast(message, tone)

export function confirm(spec: Omit<ConfirmSpec, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.getState().setConfirm({
      ...spec,
      resolve: (ok) => {
        useUI.getState().setConfirm(null)
        resolve(ok)
      },
    })
  })
}

/* ---------------- Navigation (hash) ---------------- */

export function navigate(path: string) {
  if (location.hash !== `#${path}`) location.hash = path
  window.scrollTo({ top: 0 })
}
