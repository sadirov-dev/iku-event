import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import type { Registration } from '../../lib/types'
import { useLocalize } from '../../lib/localize'
import { useFormat } from '../../lib/format'
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton, cn } from '../../components/ui'

function exportCsv(rows: Registration[], filename: string) {
  const cols: (keyof Registration)[] = ['full_name', 'student_code', 'group_name', 'faculty', 'email', 'phone', 'status', 'attended', 'registered_at', 'extra_info']
  // Quote every cell and neutralise spreadsheet formula injection (=, +, -, @).
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminRegistrations() {
  const { id } = useParams()
  const eventId = Number(id)
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const queryClient = useQueryClient()

  const event = useQuery({ queryKey: ['event', id], queryFn: () => api.event(id!) })
  const regs = useQuery({ queryKey: ['registrations', eventId], queryFn: () => api.eventRegistrations(eventId) })

  const toggle = useMutation({
    mutationFn: (r: Registration) => api.updateRegistration(eventId, r.id, { attended: !r.attended }),
    onSuccess: (updated) =>
      queryClient.setQueryData(['registrations', eventId], (old: Registration[] | undefined) =>
        old?.map((r) => (r.id === updated.id ? { ...r, attended: updated.attended } : r)),
      ),
  })

  const title = event.data ? L(event.data, 'title') : ''
  const active = regs.data?.filter((r) => r.status === 'CONFIRMED') ?? []

  return (
    <>
      <Link to="/admin/events" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('admin.events')}
      </Link>
      <PageHeader
        title={t('admin.registrations')}
        subtitle={event.data ? `${title} · ${f.dayMonth(event.data.date)}, ${event.data.start_time}` : undefined}
        actions={
          !!regs.data?.length && (
            <button className="btn-secondary" onClick={() => exportCsv(regs.data!, `registrations-${eventId}.csv`)}>
              <Download className="size-4" /> {t('admin.exportCsv')}
            </button>
          )
        }
      />

      {regs.data && (
        <p className="mb-4 text-sm text-slate-500">
          {t('event.participants')}: <strong className="text-slate-900">{active.length}</strong>
          {event.data?.capacity ? ` / ${event.data.capacity}` : ''} · {t('admin.attended')}:{' '}
          <strong className="text-slate-900">{active.filter((r) => r.attended).length}</strong>
        </p>
      )}
      {toggle.isError && (
        <div className="mb-4">
          <Alert>{errorMessage(toggle.error, t)}</Alert>
        </div>
      )}

      {regs.isError ? (
        <ErrorState message={errorMessage(regs.error, t)} onRetry={() => regs.refetch()} />
      ) : regs.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : regs.data.length === 0 ? (
        <EmptyState icon="🪑" title={t('admin.noRegistrations')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('regForm.fullName')}</th>
                <th className="px-4 py-3 font-semibold">{t('regForm.studentId')}</th>
                <th className="px-4 py-3 font-semibold">{t('regForm.group')}</th>
                <th className="px-4 py-3 font-semibold">{t('regForm.email')} / {t('regForm.phone')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin.registeredAt')}</th>
                <th className="px-4 py-3 font-semibold">{t('admin.form.status')}</th>
                <th className="px-4 py-3 text-center font-semibold">{t('admin.attended')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regs.data.map((r) => (
                <tr key={r.id} className={cn(r.status === 'CANCELLED' && 'text-slate-400')}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.full_name}</p>
                    {r.extra_info && <p className="max-w-xs truncate text-xs text-slate-500" title={r.extra_info}>{r.extra_info}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.student_code ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.group_name}
                    {r.faculty && <p className="text-xs text-slate-500">{r.faculty}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {r.email}
                    {r.phone && <p className="text-xs text-slate-500">{r.phone}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{f.dateTime(r.registered_at)}</td>
                  <td className="px-4 py-3">{t(`regStatus.${r.status}`)}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-brand-600"
                      checked={r.attended}
                      disabled={r.status !== 'CONFIRMED' || toggle.isPending}
                      onChange={() => toggle.mutate(r)}
                      aria-label={`${t('admin.attended')}: ${r.full_name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
