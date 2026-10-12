import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, errorMessage } from '../lib/api'
import type { User } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { Avatar } from '../components/Layout'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Alert, Field, PageHeader, Spinner } from '../components/ui'

function StatTile({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 text-xl" aria-hidden>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: user!.full_name,
    student_code: user!.student_code ?? '',
    group_name: user!.group_name ?? '',
    faculty: user!.faculty ?? '',
    phone: user!.phone ?? '',
  })

  const onSaved = (u: User) => queryClient.setQueryData(['me'], u)

  const save = useMutation({ mutationFn: () => api.updateProfile(form), onSuccess: onSaved })
  const avatar = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await api.upload(file)
      return api.updateProfile({ avatar: url })
    },
    onSuccess: onSaved,
  })

  if (!user) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form.full_name.trim().length < 2) return
    save.mutate()
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    save.reset()
    setForm((s) => ({ ...s, [k]: e.target.value }))
  }

  return (
    <div className="container-page max-w-4xl py-8">
      <PageHeader title={t('profile.title')} />

      <div className="card mb-6 flex flex-col items-center gap-5 p-6 sm:flex-row">
        <div className="relative">
          <Avatar name={user.full_name} src={user.avatar} size="size-24 text-2xl" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatar.isPending}
            className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-4 ring-white hover:bg-brand-700"
            aria-label={t('profile.changePhoto')}
          >
            {avatar.isPending ? <Spinner /> : <Camera className="size-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) avatar.mutate(file)
              e.target.value = ''
            }}
          />
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold">{user.full_name}</h2>
          <p className="text-slate-500">{user.email}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t(`roles.${user.role}`)}
            {user.group_name && ` · ${user.group_name}`} · {t('profile.memberSince', { date: f.shortDate(user.created_at) })}
          </p>
        </div>
      </div>
      {avatar.isError && (
        <div className="mb-6">
          <Alert>{errorMessage(avatar.error, t)}</Alert>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon="🎟️" value={user.stats.registered} label={t('profile.stats.registered')} />
        <StatTile icon="✅" value={user.stats.attended} label={t('profile.stats.attended')} />
        <StatTile icon="📜" value={user.stats.certificates} label={t('profile.stats.certificates')} />
        <StatTile icon="🏆" value={user.stats.achievements} label={t('profile.stats.achievements')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="card space-y-4 p-6 lg:col-span-3" noValidate>
          <h2 className="text-lg font-bold">{t('profile.personal')}</h2>
          {save.isError && <Alert>{errorMessage(save.error, t)}</Alert>}
          {save.isSuccess && <Alert kind="success">{t('profile.saved')}</Alert>}
          <Field label={t('profile.fullName')} htmlFor="p-name" error={form.full_name.trim().length < 2 ? t('errors.minLength', { count: 2 }) : undefined}>
            <input id="p-name" className="input" value={form.full_name} onChange={set('full_name')} autoComplete="name" />
          </Field>
          <Field label={t('profile.email')} htmlFor="p-email">
            <input id="p-email" className="input" value={user.email} disabled />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('profile.studentId')} htmlFor="p-code">
              <input id="p-code" className="input" value={form.student_code} onChange={set('student_code')} />
            </Field>
            <Field label={t('profile.group')} htmlFor="p-group">
              <input id="p-group" className="input" value={form.group_name} onChange={set('group_name')} />
            </Field>
          </div>
          <Field label={t('profile.faculty')} htmlFor="p-faculty">
            <input id="p-faculty" className="input" value={form.faculty} onChange={set('faculty')} />
          </Field>
          <Field label={t('profile.phone')} htmlFor="p-phone">
            <input id="p-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </Field>
          <div>
            <p className="label">{t('profile.language')}</p>
            <LanguageSwitcher full />
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Spinner /> {t('profile.saving')}
              </>
            ) : (
              t('profile.save')
            )}
          </button>
        </form>

        <section className="card p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">{t('profile.achievements')}</h2>
          {user.achievements.length === 0 ? (
            <p className="text-sm text-slate-500">{t('profile.noAchievements')}</p>
          ) : (
            <ul className="space-y-3">
              {user.achievements.map((a) => (
                <li key={a.code} className="flex items-center gap-3 rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                  <span className="text-2xl" aria-hidden>
                    {a.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{L(a, 'name')}</p>
                    <p className="text-xs text-slate-500">{L(a, 'description')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
