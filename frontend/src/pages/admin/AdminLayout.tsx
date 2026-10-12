import { NavLink, Outlet, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarRange, LayoutDashboard, Megaphone, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/Layout'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { cn } from '../../components/ui'

export default function AdminLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const links = [
    { to: '/admin', label: t('admin.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/events', label: t('admin.events'), icon: CalendarRange, end: false },
    ...(isAdmin
      ? [
          { to: '/admin/announcements', label: t('admin.announcements'), icon: Megaphone, end: false },
          { to: '/admin/users', label: t('admin.users'), icon: Users, end: false },
        ]
      : []),
  ]

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <span className="hidden rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white sm:inline">
            {isAdmin ? t('nav.adminPanel') : t('nav.organizerPanel')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/" className="btn-ghost btn-sm">
              <ArrowLeft className="size-4" /> <span className="hidden sm:inline">{t('admin.backToSite')}</span>
            </Link>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
