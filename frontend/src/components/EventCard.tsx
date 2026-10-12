import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import type { EventItem } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { parseDate, useFormat } from '../lib/format'
import { Skeleton, cn } from './ui'

export function EventCover({ event, className }: { event: EventItem; className?: string }) {
  const color = event.category?.color ?? '#6366f1'
  if (event.image) {
    return <img src={event.image} alt="" loading="lazy" className={cn('h-full w-full object-cover', className)} />
  }
  return (
    <div
      className={cn('flex h-full w-full items-center justify-center', className)}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}b3 55%, #1e1b4b 140%)` }}
      aria-hidden
    >
      <span className="text-5xl drop-shadow-sm">{event.category?.icon ?? '✨'}</span>
    </div>
  )
}

export function CategoryBadge({ event, className }: { event: EventItem; className?: string }) {
  const L = useLocalize()
  if (!event.category) return null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm', className)}>
      <span aria-hidden>{event.category.icon}</span>
      {L(event.category, 'name')}
    </span>
  )
}

/** Short status line for seats / registration state. */
export function SeatsInfo({ event }: { event: EventItem }) {
  const { t } = useTranslation()
  if (event.registration_state === 'CANCELLED') return <span className="font-semibold text-rose-600">{t('event.cancelled')}</span>
  if (event.registration_state === 'ENDED') return <span className="text-slate-500">{t('event.ended')}</span>
  if (event.seats_left === null) return <span>{t('event.unlimited')}</span>
  if (event.seats_left === 0) return <span className="font-semibold text-rose-600">{t('event.noSeats')}</span>
  return (
    <span className={cn(event.seats_left <= 5 && 'font-semibold text-amber-600')}>
      {t('event.seatsLeft', { count: event.seats_left })}
    </span>
  )
}

/** Card call-to-action reflecting every registration state from the spec. */
export function CardAction({ event }: { event: EventItem }) {
  const { t } = useTranslation()
  if (event.my_registration === 'CONFIRMED' || event.my_registration === 'PENDING') {
    return <span className="btn w-full bg-emerald-50 text-emerald-700">{t('event.registered')}</span>
  }
  const disabled: Record<string, string> = {
    FULL: t('event.full'),
    CLOSED: t('event.closed'),
    CANCELLED: t('event.cancelled'),
    ENDED: t('event.ended'),
  }
  if (event.registration_state !== 'OPEN') {
    return <span className="btn w-full cursor-default bg-slate-100 text-slate-500">{disabled[event.registration_state]}</span>
  }
  return (
    <Link to={`/events/${event.id}?register=1`} className="btn-primary w-full">
      {t('event.register')}
    </Link>
  )
}

export default function EventCard({ event }: { event: EventItem }) {
  const L = useLocalize()
  const f = useFormat()
  const cancelled = event.status === 'CANCELLED'

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/events/${event.id}`} className="relative block aspect-[16/9] overflow-hidden bg-slate-100">
        <EventCover event={event} className={cn('transition duration-300 group-hover:scale-[1.03]', cancelled && 'grayscale')} />
        <CategoryBadge event={event} className="absolute left-3 top-3" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/events/${event.id}`} className="mb-3">
          <h3 className={cn('line-clamp-2 text-[17px] font-bold leading-snug text-slate-900 group-hover:text-brand-700', cancelled && 'line-through decoration-rose-400')}>
            {L(event, 'title')}
          </h3>
        </Link>
        <dl className="mb-4 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-brand-500" />
            <dd className="font-medium text-slate-800">{f.eventDay(event.date)}</dd>
            <Clock className="ml-1 size-4 shrink-0 text-brand-500" />
            <dd>
              {event.start_time}–{event.end_time}
            </dd>
          </div>
          {event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-brand-500" />
              <dd className="truncate">{L(event.venue, 'name')}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-brand-500" />
            <dd>
              <SeatsInfo event={event} />
            </dd>
          </div>
        </dl>
        <div className="mt-auto">
          <CardAction event={event} />
        </div>
      </div>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Compact row: date tile + title + time + venue. Used for "upcoming" lists. */
export function EventRow({ event }: { event: EventItem }) {
  const L = useLocalize()
  const f = useFormat()
  const d = parseDate(event.date)
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-white hover:shadow-sm"
    >
      <div
        className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white"
        style={{ background: event.category?.color ?? '#6366f1' }}
      >
        <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase">{f.weekdayShort(d)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold text-slate-900 group-hover:text-brand-700', event.status === 'CANCELLED' && 'line-through')}>
          {L(event, 'title')}
        </p>
        <p className="truncate text-sm text-slate-500">
          {f.dayMonth(event.date)} · {event.start_time}
          {event.venue && ` · ${L(event.venue, 'name')}`}
        </p>
      </div>
      <span className="hidden text-xl sm:block" aria-hidden>
        {event.category?.icon}
      </span>
    </Link>
  )
}
