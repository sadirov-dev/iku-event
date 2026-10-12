import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { Alert, Field, Spinner, cn } from '../components/ui'
import i18n from '../i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-slate-500">{subtitle}</p>
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </div>
  )
}

/** After signing in, go back where the user came from (e.g. an event they wanted to join). */
function useRedirectTarget() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: () => api.login({ email: email.trim(), password }),
    onSuccess: ({ token, user }) => {
      signIn(token, user)
      navigate(target, { replace: true })
    },
  })

  if (user && !login.isSuccess) return <Navigate to={target} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (email && password) login.mutate()
  }

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" state={{ from: target }} className="font-semibold text-brand-600 hover:underline">
            {t('nav.register')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {login.isError && <Alert>{errorMessage(login.error, t)}</Alert>}
        <Field label={t('auth.email')} htmlFor="email">
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password">
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={login.isPending || !email || !password}>
          {login.isPending ? (
            <>
              <Spinner /> {t('auth.loggingIn')}
            </>
          ) : (
            t('auth.submitLogin')
          )}
        </button>
      </form>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <p className="mb-1 font-semibold">{t('auth.demo')}</p>
          {[
            ['student@iku.kg', 'Student123!'],
            ['organizer@iku.kg', 'Organizer123!'],
            ['admin@iku.kg', 'Admin123!'],
          ].map(([e, p]) => (
            <button
              key={e}
              type="button"
              className="block font-mono hover:text-brand-600"
              onClick={() => {
                setEmail(e!)
                setPassword(p!)
              }}
            >
              {e} / {p}
            </button>
          ))}
        </div>
      )}
    </AuthShell>
  )
}

export function RegisterPage() {
  const { t } = useTranslation()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const target = useRedirectTarget()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', student_code: '', group_name: '', faculty: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const register = useMutation({
    mutationFn: () => api.register({ ...form, email: form.email.trim(), language: i18n.resolvedLanguage }),
    onSuccess: ({ token, user }) => {
      signIn(token, user)
      navigate(target, { replace: true })
    },
    onError: (err) => setErrors(fieldErrors(err)),
  })

  if (user && !register.isSuccess) return <Navigate to={target} replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (form.full_name.trim().length < 2) errs.full_name = t('errors.minLength', { count: 2 })
    if (!EMAIL_RE.test(form.email.trim())) errs.email = t('errors.email')
    if (form.password.length < 8) errs.password = t('errors.minLength', { count: 8 })
    setErrors(errs)
    if (Object.keys(errs).length === 0) register.mutate()
  }

  const opt = ` (${t('auth.optional')})`

  return (
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" state={{ from: target }} className="font-semibold text-brand-600 hover:underline">
            {t('nav.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {register.isError && <Alert>{errorMessage(register.error, t)}</Alert>}
        <Field label={t('auth.fullName')} htmlFor="r-name" error={errors.full_name}>
          <input id="r-name" className={cn('input', errors.full_name && 'input-error')} autoComplete="name" value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label={t('auth.email')} htmlFor="r-email" error={errors.email}>
          <input id="r-email" type="email" className={cn('input', errors.email && 'input-error')} autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label={t('auth.password')} htmlFor="r-password" error={errors.password} hint={t('auth.passwordHint')}>
          <input
            id="r-password"
            type="password"
            className={cn('input', errors.password && 'input-error')}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('auth.studentId') + opt} htmlFor="r-code">
            <input id="r-code" className="input" value={form.student_code} onChange={set('student_code')} />
          </Field>
          <Field label={t('auth.group') + opt} htmlFor="r-group">
            <input id="r-group" className="input" value={form.group_name} onChange={set('group_name')} />
          </Field>
        </div>
        <Field label={t('auth.faculty') + opt} htmlFor="r-faculty">
          <input id="r-faculty" className="input" value={form.faculty} onChange={set('faculty')} />
        </Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={register.isPending}>
          {register.isPending ? (
            <>
              <Spinner /> {t('auth.registering')}
            </>
          ) : (
            t('auth.submitRegister')
          )}
        </button>
      </form>
    </AuthShell>
  )
}
