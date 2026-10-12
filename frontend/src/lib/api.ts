import axios, { AxiosError } from 'axios'
import type { TFunction } from 'i18next'
import type {
  AdminUser,
  Announcement,
  AppNotification,
  Category,
  EventItem,
  Paginated,
  Registration,
  User,
  Venue,
} from './types'

const TOKEN_KEY = 'iku_token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', timeout: 15_000 })

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(undefined, (error: AxiosError<{ error?: { code?: string } }>) => {
  // Expired/revoked token or a freshly blocked account: drop the session everywhere.
  const code = error.response?.data?.error?.code
  if (tokenStore.get() && (code === 'UNAUTHORIZED' || code === 'USER_BLOCKED')) {
    tokenStore.set(null)
    window.dispatchEvent(new Event('auth:expired'))
  }
  return Promise.reject(error)
})

export function errorCode(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const code = (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code
    if (code) return code
    if (!err.response) return 'NETWORK'
  }
  return 'INTERNAL_ERROR'
}

/** Field-level validation errors returned by the API, keyed by field name. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {}
  const details = (err.response?.data as { error?: { details?: unknown } } | undefined)?.error?.details
  if (!Array.isArray(details)) return {}
  return Object.fromEntries(details.map((d: { field: string; message: string }) => [d.field, d.message]))
}

/** Translated, user-friendly message — never raw server output. */
export function errorMessage(err: unknown, t: TFunction): string {
  const code = errorCode(err)
  return t(`errors.${code}`, { defaultValue: t('errors.INTERNAL_ERROR') })
}

type Query = Record<string, string | number | boolean | undefined | null>
const clean = (q: Query) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ''))
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export interface RegistrationForm {
  full_name: string
  student_code: string
  group_name: string
  faculty?: string
  email: string
  phone?: string
  extra_info?: string
}

export const api = {
  // auth
  login: (body: { email: string; password: string }) => data(http.post<{ token: string; user: User }>('/auth/login', body)),
  register: (body: Record<string, unknown>) => data(http.post<{ token: string; user: User }>('/auth/register', body)),
  logout: () => http.post('/auth/logout'),
  me: () => data(http.get<User>('/auth/me')),
  updateProfile: (body: Partial<User>) => data(http.patch<User>('/profile', body)),

  // events
  events: (q: Query) => data(http.get<Paginated<EventItem>>('/events', { params: clean(q) })),
  event: (id: number | string) => data(http.get<EventItem>(`/events/${id}`)),
  createEvent: (body: Record<string, unknown>) => data(http.post<EventItem>('/events', body)),
  updateEvent: (id: number, body: Record<string, unknown>) => data(http.patch<EventItem>(`/events/${id}`, body)),
  deleteEvent: (id: number) => http.delete(`/events/${id}`),
  registerForEvent: (id: number, body: RegistrationForm) => data(http.post<EventItem>(`/events/${id}/register`, body)),
  cancelRegistration: (id: number) => data(http.delete<EventItem>(`/events/${id}/register`)),
  myEvents: (tab: string) =>
    data(http.get<{ items: EventItem[]; counts: Record<string, number> }>('/my-events', { params: { tab } })),
  eventRegistrations: (id: number) => data(http.get<Registration[]>(`/events/${id}/registrations`)),
  updateRegistration: (eventId: number, regId: number, body: { attended?: boolean; status?: string }) =>
    data(http.patch<Registration>(`/events/${eventId}/registrations/${regId}`, body)),

  // catalog
  categories: () => data(http.get<Category[]>('/categories')),
  venues: () => data(http.get<Venue[]>('/venues')),

  // announcements
  announcements: (q: Query) => data(http.get<Paginated<Announcement>>('/announcements', { params: clean(q) })),
  announcement: (id: number | string) => data(http.get<Announcement>(`/announcements/${id}`)),
  createAnnouncement: (body: Record<string, unknown>) => data(http.post<Announcement>('/announcements', body)),
  updateAnnouncement: (id: number, body: Record<string, unknown>) =>
    data(http.patch<Announcement>(`/announcements/${id}`, body)),
  deleteAnnouncement: (id: number) => http.delete(`/announcements/${id}`),

  // notifications
  notifications: (q: Query) =>
    data(http.get<Paginated<AppNotification> & { unread: number }>('/notifications', { params: clean(q) })),
  unreadCount: () => data(http.get<{ unread: number }>('/notifications/unread-count')),
  markRead: (id: number) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch('/notifications/read-all'),

  // admin
  adminStats: () => data(http.get<AdminStats>('/admin/stats')),
  adminUsers: (q: Query) => data(http.get<Paginated<AdminUser>>('/admin/users', { params: clean(q) })),
  updateUser: (id: number, body: { role?: string; is_blocked?: boolean }) => data(http.patch(`/admin/users/${id}`, body)),

  upload: (file: File, kind: 'image' | 'document' = 'image') => {
    const form = new FormData()
    form.append('file', file)
    return data(http.post<{ url: string }>('/uploads', form, { params: { kind } }))
  },
}

export interface AdminStats {
  totals: {
    students: number
    organizers: number
    events: number
    upcoming_events: number
    pending_events: number
    events_this_month: number
    registrations: number
    attended: number
    important_announcements: number
    attendance_rate: number | null
  }
  upcoming: EventItem[]
  pending: EventItem[]
  by_category: (Pick<Category, 'slug' | 'name_ky' | 'name_ru' | 'name_en' | 'color'> & { registrations: number })[]
}
