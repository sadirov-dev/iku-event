import type { Lang } from '../i18n'

export type Role = 'STUDENT' | 'ORGANIZER' | 'ADMIN'
export type EventStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED'
export type RegistrationState = 'OPEN' | 'FULL' | 'CLOSED' | 'ENDED' | 'CANCELLED'
export type AnnouncementType = 'IMPORTANT' | 'ACADEMIC' | 'EVENT' | 'GENERAL' | 'URGENT'
export type Priority = 'LOW' | 'NORMAL' | 'HIGH'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Category {
  id: number
  slug: string
  name_ky: string | null
  name_ru: string | null
  name_en: string | null
  icon: string | null
  color: string | null
  upcoming_count?: number
}

export interface Venue {
  id: number
  name_ky: string | null
  name_ru: string | null
  name_en: string | null
  building: string | null
  floor: string | null
  room: string | null
  capacity: number | null
}

export interface EventItem {
  id: number
  title_ky: string | null
  title_ru: string | null
  title_en: string | null
  description_ky: string | null
  description_ru: string | null
  description_en: string | null
  requirements_ky: string | null
  requirements_ru: string | null
  requirements_en: string | null
  program_ky: string | null
  program_ru: string | null
  program_en: string | null
  image: string | null
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string
  capacity: number | null
  registration_deadline: string | null
  status: EventStatus
  contact: string | null
  category_id: number | null
  venue_id: number | null
  organizer_id: number | null
  category: Category | null
  venue: Venue | null
  organizer: { id: number; full_name: string } | null
  registered_count: number
  seats_left: number | null
  my_registration: RegistrationStatus | null
  my_attended: boolean | null
  registration_state: RegistrationState
  is_past: boolean
  can_manage?: boolean
  created_at: string
}

export interface Registration {
  id: number
  student_id: number
  status: RegistrationStatus
  full_name: string
  student_code: string | null
  group_name: string | null
  faculty: string | null
  email: string
  phone: string | null
  extra_info: string | null
  attended: boolean
  registered_at: string
}

export interface Announcement {
  id: number
  title_ky: string | null
  title_ru: string | null
  title_en: string | null
  content_ky: string | null
  content_ru: string | null
  content_en: string | null
  category: AnnouncementType
  priority: Priority
  is_pinned: boolean
  image: string | null
  attachment: string | null
  published_at: string
  expires_at: string | null
  is_active: boolean
  author: { id: number; full_name: string } | null
}

export interface AppNotification {
  id: number
  type: string
  title_ky: string | null
  title_ru: string | null
  title_en: string | null
  message_ky: string | null
  message_ru: string | null
  message_en: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface Achievement {
  code: string
  icon: string | null
  name_ky: string | null
  name_ru: string | null
  name_en: string | null
  description_ky: string | null
  description_ru: string | null
  description_en: string | null
  awarded_at: string
}

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_main_admin: boolean
  language: Lang
  avatar: string | null
  created_at: string
  student_code: string | null
  group_name: string | null
  faculty: string | null
  phone: string | null
  stats: { registered: number; attended: number; certificates: number; achievements: number }
  achievements: Achievement[]
}

export interface AdminUser {
  id: number
  email: string
  full_name: string
  role: Role
  is_main_admin: boolean
  is_blocked: boolean
  created_at: string
  student_code: string | null
  group_name: string | null
  registrations: number
}
