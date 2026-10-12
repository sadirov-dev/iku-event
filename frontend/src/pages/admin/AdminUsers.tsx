import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { api, errorMessage } from '../../lib/api'
import type { Role } from '../../lib/types'
import { useFormat } from '../../lib/format'
import { Avatar } from '../../components/Layout'
import { Alert, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, cn } from '../../components/ui'

const ROLES: Role[] = ['STUDENT', 'ORGANIZER', 'ADMIN']
const PAGE_SIZE = 20

export default function AdminUsers() {
  const { t } = useTranslation()
  const f = useFormat()
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const role = params.get('role') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  const query = { search, role, page, pageSize: PAGE_SIZE }
  const q = useQuery({ queryKey: ['admin', 'users', query], queryFn: () => api.adminUsers(query), placeholderData: keepPreviousData })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { role?: Role; is_blocked?: boolean } }) => api.updateUser(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  return (
    <>
      <PageHeader title={t('admin.users')} subtitle={q.data ? String(q.data.total) : undefined} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          className="input sm:max-w-sm"
          placeholder={t('admin.usersTable.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className="input sm:w-56" value={role} onChange={(e) => setParams(e.target.value ? { role: e.target.value } : {})}>
          <option value="">{t('admin.usersTable.allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </div>
      {update.isError && (
        <div className="mb-4">
          <Alert>{errorMessage(update.error, t)}</Alert>
        </div>
      )}

      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon="👤" title={t('errors.USER_NOT_FOUND')} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.user')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.group')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.registrations')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.joined')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.role')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.usersTable.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((u) => {
                  const self = u.id === me?.id
                  return (
                    <tr key={u.id} className={cn(u.is_blocked && 'bg-rose-50/40')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} size="size-8" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{u.full_name}</p>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.group_name ?? '—'}
                        {u.student_code && <p className="font-mono text-xs text-slate-500">{u.student_code}</p>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{u.registrations}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{f.shortDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <select
                          className="input w-40 py-1.5"
                          value={u.role}
                          disabled={self || update.isPending}
                          onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value as Role } })}
                          aria-label={t('admin.usersTable.role')}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`roles.${r}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-semibold', u.is_blocked ? 'text-rose-600' : 'text-emerald-700')}>
                            {u.is_blocked ? t('admin.usersTable.blocked') : t('admin.usersTable.active')}
                          </span>
                          {!self && (
                            <button
                              className={cn('btn-sm', u.is_blocked ? 'btn-secondary' : 'btn-ghost text-rose-600')}
                              disabled={update.isPending}
                              onClick={() => update.mutate({ id: u.id, body: { is_blocked: !u.is_blocked } })}
                            >
                              {u.is_blocked ? t('admin.usersTable.unblock') : t('admin.usersTable.block')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={q.data.total} pageSize={PAGE_SIZE} onChange={(p) => setParams({ ...(role ? { role } : {}), page: String(p) })} />
        </>
      )}
    </>
  )
}
