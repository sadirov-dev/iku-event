import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import type { Announcement, AnnouncementType, Priority } from '../../lib/types'
import { LANGUAGES } from '../../i18n'
import { FileUpload, TranslationTabs, fromLocalInput, toLocalInput } from '../../components/FormBits'
import { Alert, ErrorState, Field, PageHeader, PageSpinner, Spinner } from '../../components/ui'

const TYPES: AnnouncementType[] = ['GENERAL', 'IMPORTANT', 'URGENT', 'ACADEMIC', 'EVENT']
const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH']

/** Loads the announcement (when editing), then mounts the form with it as initial state. */
export default function AdminAnnouncementForm() {
  const { id } = useParams()
  const { t } = useTranslation()
  const existing = useQuery({ queryKey: ['announcement', id], queryFn: () => api.announcement(id!), enabled: !!id })

  if (id && existing.isPending) return <PageSpinner />
  if (id && existing.isError) return <ErrorState message={errorMessage(existing.error, t)} />
  return <AnnouncementForm key={id ?? 'new'} announcement={existing.data} />
}

function initialTexts(a?: Announcement) {
  const tx: Record<string, string> = {}
  if (a) for (const f of ['title', 'content']) for (const l of LANGUAGES) tx[`${f}_${l}`] = (a[`${f}_${l}` as keyof Announcement] as string | null) ?? ''
  return tx
}

function AnnouncementForm({ announcement: a }: { announcement?: Announcement }) {
  const isEdit = !!a
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [texts, setTexts] = useState(() => initialTexts(a))
  const [category, setCategory] = useState<AnnouncementType>(a?.category ?? 'GENERAL')
  const [priority, setPriority] = useState<Priority>(a?.priority ?? 'NORMAL')
  const [pinned, setPinned] = useState(a?.is_pinned ?? false)
  const [image, setImage] = useState<string | null>(a?.image ?? null)
  const [attachment, setAttachment] = useState<string | null>(a?.attachment ?? null)
  const [publishedAt, setPublishedAt] = useState(() => toLocalInput(a?.published_at))
  const [expiresAt, setExpiresAt] = useState(() => toLocalInput(a?.expires_at))
  const [titleError, setTitleError] = useState<string>()

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.trim() || null])),
        category,
        priority,
        is_pinned: pinned,
        image,
        attachment,
        published_at: fromLocalInput(publishedAt),
        expires_at: fromLocalInput(expiresAt),
      }
      return a ? api.updateAnnouncement(a.id, body) : api.createAnnouncement(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcement'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      navigate('/admin/announcements')
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const hasTitle = LANGUAGES.some((l) => texts[`title_${l}`]?.trim())
    setTitleError(hasTitle ? undefined : t('errors.titleRequired'))
    if (hasTitle) save.mutate()
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl">
      <Link to="/admin/announcements" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('admin.announcements')}
      </Link>
      <PageHeader title={isEdit ? t('admin.editAnnouncement') : t('admin.newAnnouncement')} />
      {save.isError && (
        <div className="mb-4">
          <Alert>{errorMessage(save.error, t)}</Alert>
        </div>
      )}
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <TranslationTabs
            values={texts}
            onChange={(k, v) => setTexts((s) => ({ ...s, [k]: v }))}
            error={titleError}
            fields={[
              { key: 'title', label: t('admin.form.titleField') },
              { key: 'content', label: t('admin.form.content'), multiline: true, rows: 8 },
            ]}
          />
        </section>
        <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field label={t('admin.form.type')} htmlFor="type">
            <select id="type" className="input" value={category} onChange={(e) => setCategory(e.target.value as AnnouncementType)}>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`announcements.type.${x}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.form.priority')} htmlFor="priority">
            <select id="priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  {t(`announcements.priority.${x}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.form.publishAt')} htmlFor="pub">
            <input id="pub" type="datetime-local" className="input" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
          </Field>
          <Field label={t('admin.form.expiresAt')} htmlFor="exp">
            <input id="exp" type="datetime-local" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" className="size-5 accent-brand-600" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            <span className="text-sm font-medium">{t('admin.form.pinned')}</span>
          </label>
          <div>
            <p className="label">{t('admin.form.cover')}</p>
            <FileUpload value={image} onChange={setImage} label={t('admin.form.upload')} />
          </div>
          <div>
            <p className="label">{t('admin.form.attachment')}</p>
            <FileUpload value={attachment} onChange={setAttachment} kind="document" label={t('admin.form.uploadFile')} />
          </div>
        </section>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Spinner /> {t('admin.form.saving')}
              </>
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
