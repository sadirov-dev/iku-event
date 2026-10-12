import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Paperclip, Pin } from 'lucide-react'
import type { Announcement, AnnouncementType } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { Skeleton, cn } from './ui'

export const TYPE_STYLES: Record<AnnouncementType, string> = {
  URGENT: 'bg-rose-100 text-rose-700',
  IMPORTANT: 'bg-amber-100 text-amber-800',
  ACADEMIC: 'bg-sky-100 text-sky-800',
  EVENT: 'bg-violet-100 text-violet-800',
  GENERAL: 'bg-slate-100 text-slate-700',
}

export function TypeBadge({ type }: { type: AnnouncementType }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', TYPE_STYLES[type])}>
      {t(`announcements.type.${type}`)}
    </span>
  )
}

export const isImportant = (a: Announcement) => a.category === 'URGENT' || a.category === 'IMPORTANT' || a.priority === 'HIGH'

export default function AnnouncementCard({ a, compact = false }: { a: Announcement; compact?: boolean }) {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const important = isImportant(a)

  return (
    <Link
      to={`/announcements/${a.id}`}
      className={cn(
        'card group block p-4 transition hover:shadow-md sm:p-5',
        important && 'border-l-4',
        a.category === 'URGENT' ? 'border-l-rose-500' : important && 'border-l-amber-400',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TypeBadge type={a.category} />
        {a.is_pinned && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
            <Pin className="size-3.5" /> {t('announcements.pinned')}
          </span>
        )}
        {a.attachment && <Paperclip className="size-3.5 text-slate-400" aria-label={t('announcements.attachment')} />}
      </div>
      <h3 className="font-bold leading-snug text-slate-900 group-hover:text-brand-700">{L(a, 'title')}</h3>
      <p className={cn('mt-1 text-sm text-slate-600', compact ? 'line-clamp-2' : 'line-clamp-3')}>{L(a, 'content')}</p>
      <p className="mt-3 text-xs text-slate-400">
        {f.shortDate(a.published_at)}
        {a.author && ` · ${a.author.full_name}`}
        {a.priority === 'HIGH' && ` · ${t('announcements.priority.HIGH')}`}
      </p>
    </Link>
  )
}

export function AnnouncementSkeleton() {
  return (
    <div className="card space-y-3 p-5">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  )
}
