import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock, Mail, MapPin, Pencil, User, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, errorCode, errorMessage } from '../lib/api'
import type { EventItem } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { CategoryBadge, EventCover, SeatsInfo } from '../components/EventCard'
import RegisterModal from '../components/RegisterModal'
import { Alert, EmptyState, ErrorState, Skeleton, Spinner, StatusBadge, cn } from '../components/ui'

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="font-semibold text-slate-900">{children}</dd>
      </div>
    </div>
  )
}

function RegistrationPanel({ event }: { event: EventItem }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(false)

  const registered = event.my_registration === 'CONFIRMED' || event.my_registration === 'PENDING'

  // Cards link here with ?register=1 to open the form straight away.
  useEffect(() => {
    if (params.get('register') !== '1') return
    setParams((p) => (p.delete('register'), p), { replace: true })
    if (!user) navigate('/login', { state: { from: location.pathname + '?register=1' } })
    else if (event.registration_state === 'OPEN' && !registered) setModal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancel = useMutation({
    mutationFn: () => api.cancelRegistration(event.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['event', String(event.id)], (old: EventItem | undefined) => ({ ...old, ...updated }))
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['my-events'] })
    },
  })

  const fillPct = event.capacity ? Math.min(100, Math.round((event.registered_count / event.capacity) * 100)) : null

  let action: React.ReactNode
  if (registered) {
    action = (
      <>
        <div className="btn w-full bg-emerald-50 py-3 text-emerald-700">{t('event.registered')}</div>
        {!event.is_past && event.registration_state !== 'CANCELLED' && (
          <button
            className="btn-ghost mt-2 w-full text-sm text-slate-500"
            disabled={cancel.isPending}
            onClick={() => window.confirm(t('event.cancelConfirm')) && cancel.mutate()}
          >
            {cancel.isPending ? (
              <>
                <Spinner /> {t('event.cancelling')}
              </>
            ) : (
              t('event.cancelRegistration')
            )}
          </button>
        )}
      </>
    )
  } else if (event.registration_state !== 'OPEN') {
    const label = { FULL: t('event.full'), CLOSED: t('event.closed'), CANCELLED: t('event.cancelled'), ENDED: t('event.ended') }[
      event.registration_state
    ]
    action = (
      <div className={cn('btn w-full py-3', event.registration_state === 'CANCELLED' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500')}>
        {label}
      </div>
    )
  } else if (!user) {
    action = (
      <Link to="/login" state={{ from: `/events/${event.id}?register=1` }} className="btn-primary w-full py-3">
        {t('event.signInToRegister')}
      </Link>
    )
  } else {
    action = (
      <button className="btn-primary w-full py-3 text-base" onClick={() => setModal(true)}>
        {t('event.register')}
      </button>
    )
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-500">{t('event.participants')}</span>
        <span className="text-sm font-semibold text-slate-900">
          {event.capacity
            ? t('event.registeredOf', { count: event.registered_count, capacity: event.capacity })
            : t('event.registeredCount', { count: event.registered_count })}
        </span>
      </div>
      {fillPct !== null && (
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div
            className={cn('h-full rounded-full', fillPct >= 100 ? 'bg-rose-500' : fillPct >= 80 ? 'bg-amber-500' : 'bg-brand-500')}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}
      <p className="mb-5 text-sm text-slate-600">
        <SeatsInfo event={event} />
      </p>
      {cancel.isError && (
        <div className="mb-3">
          <Alert>{errorMessage(cancel.error, t)}</Alert>
        </div>
      )}
      {action}
      {event.registration_deadline && event.registration_state === 'OPEN' && (
        <p className="mt-3 text-center text-xs text-slate-500">{t('event.deadline', { date: f.dateTime(event.registration_deadline) })}</p>
      )}
      {modal && <RegisterModal event={event} open={modal} onClose={() => setModal(false)} />}
    </div>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()

  const { data: event, isPending, isError, error, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id!),
  })

  if (isPending) {
    return (
      <div className="container-page py-8">
        <Skeleton className="mb-6 aspect-[21/9] w-full rounded-3xl" />
        <Skeleton className="mb-3 h-9 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    )
  }
  if (isError) {
    const code = errorCode(error)
    return (
      <div className="container-page py-12">
        {code === 'EVENT_NOT_FOUND' || code === 'VALIDATION_ERROR' ? (
          <EmptyState
            icon="🔎"
            title={t('errors.EVENT_NOT_FOUND')}
            action={<Link to="/events" className="btn-primary">{t('event.back')}</Link>}
          />
        ) : (
          <ErrorState message={errorMessage(error, t)} onRetry={() => refetch()} />
        )}
      </div>
    )
  }

  const description = L(event, 'description')
  const requirements = L(event, 'requirements')
  const program = L(event, 'program')
  const venue = event.venue
  const venueDetails = venue
    ? [
        venue.building && venue.building !== '—' && t('event.building', { building: venue.building }),
        venue.floor && venue.floor !== '—' && t('event.floor', { floor: venue.floor }),
        venue.room && venue.room !== '—' && t('event.room', { room: venue.room }),
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div className="container-page py-6 sm:py-8">
      <Link to="/events" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('event.back')}
      </Link>

      <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-3xl bg-slate-100 sm:aspect-[3/1] lg:aspect-[7/2]">
        <EventCover event={event} className={cn(event.status === 'CANCELLED' && 'grayscale')} />
        <CategoryBadge event={event} className="absolute left-4 top-4 text-sm" />
      </div>

      {event.status === 'CANCELLED' && (
        <div className="mb-6">
          <Alert>
            <strong>{t('event.cancelled')}</strong>
          </Alert>
        </div>
      )}

      {/* Mobile order: header → registration → details. Desktop: registration is a sticky sidebar. */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">{L(event, 'title')}</h1>
            {event.can_manage && (
              <div className="flex items-center gap-2">
                <StatusBadge status={event.status} />
                <Link to={`/admin/events/${event.id}/edit`} className="btn-secondary btn-sm">
                  <Pencil className="size-3.5" /> {t('event.edit')}
                </Link>
                <Link to={`/admin/events/${event.id}/registrations`} className="btn-secondary btn-sm">
                  <Users className="size-3.5" /> {t('admin.registrations')}
                </Link>
              </div>
            )}
          </div>

          {/* What / when / where at a glance */}
          <dl className="card grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
            <InfoRow icon={<CalendarDays className="size-5" />} label={t('event.date')}>
              {f.fullDate(event.date)}
            </InfoRow>
            <InfoRow icon={<Clock className="size-5" />} label={t('event.time')}>
              {event.start_time} – {event.end_time}
            </InfoRow>
            <InfoRow icon={<MapPin className="size-5" />} label={t('event.venue')}>
              {venue ? L(venue, 'name') : t('common.none')}
              {venueDetails && <span className="block text-sm font-normal text-slate-500">{venueDetails}</span>}
            </InfoRow>
            <InfoRow icon={<User className="size-5" />} label={t('event.organizer')}>
              {event.organizer?.full_name ?? t('common.none')}
            </InfoRow>
          </dl>
        </div>

        <aside className="lg:sticky lg:top-24 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-start">
          <RegistrationPanel event={event} />
        </aside>

        <div className="lg:col-span-2">
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">{t('event.about')}</h2>
            <p className="prose-text">{description || t('event.noDescription')}</p>
          </section>

          {requirements && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold">{t('event.requirements')}</h2>
              <p className="prose-text">{requirements}</p>
            </section>
          )}

          {program && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold">{t('event.program')}</h2>
              <ol className="space-y-2">
                {program.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-white p-3 text-slate-700 ring-1 ring-slate-200">
                    <span className="mt-0.5 size-2 shrink-0 translate-y-1.5 rounded-full bg-brand-500" />
                    {line}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {event.contact && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-bold">{t('event.contact')}</h2>
              <p className="flex items-center gap-2 text-slate-700">
                <Mail className="size-4 text-brand-500" /> {event.contact}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
