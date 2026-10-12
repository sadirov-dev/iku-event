import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Ticket,
  User as UserIcon,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import LanguageSwitcher from './LanguageSwitcher'
import { cn } from './ui'

/** Staff get a panel: admins the admin panel, organizers their own one. Students get null. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePanelLink() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (user?.role === 'ADMIN') return { to: '/admin', label: t('nav.adminPanel') }
  if (user?.role === 'ORGANIZER') return { to: '/admin', label: t('nav.organizerPanel') }
  return null
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg">
        IKU <span className="text-brand-600">Events</span>
      </span>
    </Link>
  )
}

export function Avatar({ name, src, size = 'size-9' }: { name: string; src?: string | null; size?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return src ? (
    <img src={src} alt="" className={cn(size, 'rounded-full object-cover')} />
  ) : (
    <span
      className={cn(size, 'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700')}
      aria-hidden
    >
      {initials}
    </span>
  )
}

function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: api.unreadCount,
    enabled,
    refetchInterval: 60_000,
    select: (d) => d.unread,
  })
}

function NotificationBell() {
  const { t } = useTranslation()
  const { data: unread = 0 } = useUnreadCount(true)
  return (
    <Link
      to="/notifications"
      className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
      aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

function UserMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panel = usePanelLink()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl p-1 pr-2 transition hover:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={user.full_name} src={user.avatar} size="size-8" />
        <ChevronDown className="size-4 text-slate-500" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-12 z-50 w-60 overflow-hidden p-1.5 shadow-lg" onClick={() => setOpen(false)}>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs font-semibold text-brand-700">{t(`roles.${user.role}`)}</p>
          </div>
          <hr className="my-1 border-slate-100" />
          <MenuLink to="/profile" icon={<UserIcon className="size-4" />}>{t('nav.profile')}</MenuLink>
          <MenuLink to="/my-events" icon={<Ticket className="size-4" />}>{t('nav.myEvents')}</MenuLink>
          {panel && <MenuLink to={panel.to} icon={<LayoutDashboard className="size-4" />}>{panel.label}</MenuLink>}
          <hr className="my-1 border-slate-100" />
          <button
            role="menuitem"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="size-4" /> {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  )
}

function MenuLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link role="menuitem" to={to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
      {icon}
      {children}
    </Link>
  )
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const panel = usePanelLink()
  if (!open) return null
  const links = [
    ...(panel ? [{ to: panel.to, label: panel.label, icon: LayoutDashboard }] : []),
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/events', label: t('nav.events'), icon: Sparkles },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarDays },
    { to: '/announcements', label: t('nav.announcements'), icon: Megaphone },
    ...(user
      ? [
          { to: '/my-events', label: t('nav.myEvents'), icon: Ticket },
          { to: '/notifications', label: t('nav.notifications'), icon: Bell },
          { to: '/profile', label: t('nav.profile'), icon: UserIcon },
        ]
      : []),
  ]

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <button className="btn-ghost p-2" onClick={onClose} aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                )
              }
            >
              <Icon className="size-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('nav.language')}</p>
          <LanguageSwitcher full />
        </div>
        <div className="mt-auto pt-6">
          {user ? (
            <button
              className="btn-secondary w-full text-rose-600"
              onClick={async () => {
                onClose()
                await signOut()
                navigate('/')
              }}
            >
              <LogOut className="size-4" /> {t('nav.logout')}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/login" onClick={onClose} className="btn-secondary">{t('nav.login')}</Link>
              <Link to="/register" onClick={onClose} className="btn-primary">{t('nav.register')}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BottomNav() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const panel = usePanelLink()
  const items = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/events', label: t('nav.events'), icon: Sparkles },
    // Staff swap the calendar (still in the menu) for their panel.
    panel ? { to: panel.to, label: t('nav.panelShort'), icon: LayoutDashboard } : { to: '/calendar', label: t('nav.calendar'), icon: CalendarDays },
    { to: '/my-events', label: t('nav.myEventsShort'), icon: Ticket },
    user ? { to: '/profile', label: t('nav.profile'), icon: UserIcon } : { to: '/login', label: t('nav.login'), icon: UserIcon },
  ]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="mobile"
    >
      <div className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight',
                isActive ? 'text-brand-600' : 'text-slate-500',
              )
            }
          >
            <Icon className="size-5" />
            <span className="w-full truncate text-center">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()
  const panel = usePanelLink()
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/events', label: t('nav.events') },
    { to: '/calendar', label: t('nav.calendar') },
    { to: '/announcements', label: t('nav.announcements') },
    ...(user ? [{ to: '/my-events', label: t('nav.myEvents') }] : []),
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-4">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            {panel && (
              <div className="hidden lg:block">
                <Link to={panel.to} className="btn-primary btn-sm" title={panel.label}>
                  <LayoutDashboard className="size-4" /> <span className="hidden xl:inline">{panel.label}</span>
                </Link>
              </div>
            )}
            {user && <NotificationBell />}
            <div className="hidden lg:block">
              {user ? (
                <UserMenu />
              ) : (
                !isLoading && (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="btn-ghost">{t('nav.login')}</Link>
                    <Link to="/register" className="btn-primary">{t('nav.register')}</Link>
                  </div>
                )
              )}
            </div>
            <button className="btn-ghost p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label={t('nav.menu')}>
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />

      <main className="flex-1 pb-24 lg:pb-12">
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-white py-8 text-sm text-slate-500 lg:block">
        <div className="container-page flex items-center justify-between">
          <span>© {new Date().getFullYear()} IKU Events</span>
          <span>{t('hero.subtitle')}</span>
        </div>
      </footer>

      <BottomNav />
    </div>
  )
}
