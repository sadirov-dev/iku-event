import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import type { Role } from './lib/types'
import Layout from './components/Layout'
import { PageSpinner } from './components/ui'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AnnouncementDetailPage from './pages/AnnouncementDetailPage'
import MyEventsPage from './pages/MyEventsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import NotFoundPage from './pages/NotFoundPage'

// Less-visited, heavier screens are split into their own chunks.
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
const AdminEventForm = lazy(() => import('./pages/admin/AdminEventForm'))
const AdminRegistrations = lazy(() => import('./pages/admin/AdminRegistrations'))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'))
const AdminAnnouncementForm = lazy(() => import('./pages/admin/AdminAnnouncementForm'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <NotFoundPage forbidden />
  return <>{children}</>
}

const STAFF: Role[] = ['ADMIN', 'ORGANIZER']

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
          <Route path="my-events" element={<RequireAuth><MyEventsPage /></RequireAuth>} />
          <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="organizer" element={<Navigate to="/admin/events" replace />} />
        <Route path="admin" element={<RequireAuth roles={STAFF}><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/new" element={<AdminEventForm />} />
          <Route path="events/:id/edit" element={<AdminEventForm />} />
          <Route path="events/:id/registrations" element={<AdminRegistrations />} />
          <Route path="announcements" element={<RequireAuth roles={['ADMIN']}><AdminAnnouncements /></RequireAuth>} />
          <Route path="announcements/new" element={<RequireAuth roles={['ADMIN']}><AdminAnnouncementForm /></RequireAuth>} />
          <Route path="announcements/:id/edit" element={<RequireAuth roles={['ADMIN']}><AdminAnnouncementForm /></RequireAuth>} />
          <Route path="users" element={<RequireAuth roles={['ADMIN']}><AdminUsers /></RequireAuth>} />
        </Route>
      </Routes>
    </Suspense>
  )
}
