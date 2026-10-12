import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api, errorMessage } from '../../lib/api'
import type { EventItem, EventStatus } from '../../lib/types'
import { useLocalize } from '../../lib/localize'
import { LANGUAGES } from '../../i18n'
import { FileUpload, TranslationTabs, fromLocalInput, toLocalInput } from '../../components/FormBits'
import { Alert, ErrorState, Field, PageHeader, PageSpinner, Spinner } from '../../components/ui'

const TEXT_FIELDS = ['title', 'description', 'requirements', 'program'] as const
const STATUSES: EventStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED']

type FormState = {
  texts: Record<string, string>
  image: string | null
  category_id: string
  venue_id: string
  date: string
  start_time: string
  end_time: string
  capacity: string
  registration_deadline: string
  contact: string
  status: EventStatus
}

const empty: FormState = {
  texts: {},
  image: null,
  category_id: '',
  venue_id: '',
  date: '',
  start_time: '10:00',
  end_time: '12:00',
  capacity: '',
  registration_deadline: '',
  contact: '',
  status: 'DRAFT',
}

function fromEvent(e: EventItem): FormState {
  const texts: Record<string, string> = {}
  for (const f of TEXT_FIELDS) for (const l of LANGUAGES) texts[`${f}_${l}`] = (e[`${f}_${l}` as keyof EventItem] as string | null) ?? ''
  return {
    texts,
    image: e.image,
    category_id: e.category_id ? String(e.category_id) : '',
    venue_id: e.venue_id ? String(e.venue_id) : '',
    date: e.date,
    start_time: e.start_time,
    end_time: e.end_time,
    capacity: e.capacity ? String(e.capacity) : '',
    registration_deadline: toLocalInput(e.registration_deadline),
    contact: e.contact ?? '',
    status: e.status,
  }
}

/** Loads the event (when editing), then mounts the form with it as initial state. */
export default function AdminEventForm() {
  const { id } = useParams()
  const { t } = useTranslation()
  const existing = useQuery({ queryKey: ['event', id], queryFn: () => api.event(id!), enabled: !!id })

  if (id && existing.isPending) return <PageSpinner />
  if (id && existing.isError) return <ErrorState message={errorMessage(existing.error, t)} />
  return <EventForm key={id ?? 'new'} event={existing.data} />
}

function EventForm({ event: existing }: { event?: EventItem }) {
  const isEdit = !!existing
  const { t } = useTranslation()
  const L = useLocalize()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories })
  const venues = useQuery({ queryKey: ['venues'], queryFn: api.venues })

  // Initialised once; later background refetches never overwrite what the user is typing.
  const [form, setForm] = useState<FormState>(() => (existing ? fromEvent(existing) : empty))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (status: EventStatus) => {
      const body = {
        ...Object.fromEntries(Object.entries(form.texts).map(([k, v]) => [k, v.trim() || null])),
        image: form.image,
        category_id: form.category_id ? Number(form.category_id) : null,
        venue_id: form.venue_id ? Number(form.venue_id) : null,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        capacity: form.capacity ? Number(form.capacity) : null,
        registration_deadline: fromLocalInput(form.registration_deadline),
        contact: form.contact.trim() || null,
        // Only send status when it changes — organizers may not re-send e.g. PUBLISHED.
        ...(isEdit && status === existing.status ? {} : { status }),
      }
      return existing ? api.updateEvent(existing.id, body) : api.createEvent(body)
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.setQueryData(['event', String(event.id)], event)
      navigate('/admin/events')
    },
  })

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (status: EventStatus) => (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Record<string, string> = {}
    if (!LANGUAGES.some((l) => form.texts[`title_${l}`]?.trim())) errs.title = t('errors.titleRequired')
    if (!form.date) errs.date = t('errors.required')
    if (!form.start_time) errs.start_time = t('errors.required')
    if (!form.end_time) errs.end_time = t('errors.required')
    else if (form.end_time <= form.start_time) errs.end_time = t('errors.endAfterStart')
    setErrors(errs)
    if (Object.keys(errs).length === 0) save.mutate(status)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saving = save.isPending

  return (
    <form onSubmit={submit(form.status)} noValidate className="mx-auto max-w-4xl">
      <Link to="/admin/events" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('admin.events')}
      </Link>
      <PageHeader title={isEdit ? t('admin.editEvent') : t('admin.newEvent')} />
      {save.isError && (
        <div className="mb-4">
          <Alert>{errorMessage(save.error, t)}</Alert>
        </div>
      )}

      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 font-bold">{t('admin.form.translations')}</h2>
          <TranslationTabs
            values={form.texts}
            onChange={(k, v) => set('texts', { ...form.texts, [k]: v })}
            error={errors.title}
            fields={[
              { key: 'title', label: t('admin.form.titleField') },
              { key: 'description', label: t('admin.form.description'), multiline: true, rows: 6 },
              { key: 'requirements', label: t('admin.form.requirements'), multiline: true, rows: 3 },
              { key: 'program', label: t('admin.form.program'), multiline: true, rows: 4 },
            ]}
          />
        </section>

        <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h2 className="font-bold sm:col-span-2">{t('admin.form.basics')}</h2>
          <div className="sm:col-span-2">
            <p className="label">{t('admin.form.cover')}</p>
            <FileUpload value={form.image} onChange={(v) => set('image', v)} label={t('admin.form.upload')} />
          </div>
          <Field label={t('admin.form.category')} htmlFor="category">
            <select id="category" className="input" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">{t('admin.form.noneSelected')}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {L(c, 'name')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.form.venue')} htmlFor="venue">
            <select id="venue" className="input" value={form.venue_id} onChange={(e) => set('venue_id', e.target.value)}>
              <option value="">{t('admin.form.noneSelected')}</option>
              {venues.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {L(v, 'name')}
                  {v.capacity ? ` (${v.capacity})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t('admin.form.date')} *`} htmlFor="date" error={errors.date}>
            <input id="date" type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('admin.form.startTime')} *`} htmlFor="start" error={errors.start_time}>
              <input id="start" type="time" className="input" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
            </Field>
            <Field label={`${t('admin.form.endTime')} *`} htmlFor="end" error={errors.end_time}>
              <input id="end" type="time" className="input" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
            </Field>
          </div>
          <Field label={t('admin.form.capacity')} htmlFor="capacity" hint={t('admin.form.capacityHint')}>
            <input
              id="capacity"
              type="number"
              min={1}
              className="input"
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label={t('admin.form.deadline')} htmlFor="deadline">
            <input
              id="deadline"
              type="datetime-local"
              className="input"
              value={form.registration_deadline}
              onChange={(e) => set('registration_deadline', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('admin.form.contact')} htmlFor="contact">
              <input id="contact" className="input" value={form.contact} onChange={(e) => set('contact', e.target.value)} maxLength={300} />
            </Field>
          </div>
          {isEdit && isAdmin && (
            <Field label={t('admin.form.status')} htmlFor="status">
              <select id="status" className="input" value={form.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
          {saving && <Spinner className="self-center text-slate-400" />}
          {isEdit ? (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('admin.form.saving') : t('admin.form.saveChanges')}
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" disabled={saving} onClick={submit('DRAFT')}>
                {t('admin.form.saveDraft')}
              </button>
              <button type="button" className={isAdmin ? 'btn-secondary' : 'btn-primary'} disabled={saving} onClick={submit('PENDING')}>
                {t('admin.form.submitReview')}
              </button>
              {isAdmin && (
                <button type="button" className="btn-primary" disabled={saving} onClick={submit('PUBLISHED')}>
                  {t('admin.form.publishNow')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </form>
  )
}
