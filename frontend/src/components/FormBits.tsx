import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { FileText, ImagePlus, Trash2 } from 'lucide-react'
import { LANGUAGES, type Lang } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { Spinner, cn } from './ui'

const FLAGS: Record<Lang, string> = { ky: '🇰🇬', ru: '🇷🇺', en: '🇬🇧' }

/** Tabbed editor for `field_ky / field_ru / field_en` content. A dot marks languages that have content. */
export function TranslationTabs({
  fields,
  values,
  onChange,
  error,
}: {
  fields: { key: string; label: string; multiline?: boolean; rows?: number }[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  error?: string
}) {
  const { t, i18n } = useTranslation()
  const [lang, setLang] = useState<Lang>((i18n.resolvedLanguage as Lang) ?? 'ru')

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        {LANGUAGES.map((l) => {
          const filled = !!values[`${fields[0]!.key}_${l}`]?.trim()
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition',
                lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {FLAGS[l]} {t(`languages.${l}`)}
              <span className={cn('size-1.5 rounded-full', filled ? 'bg-emerald-500' : 'bg-slate-300')} />
            </button>
          )
        })}
      </div>
      <div className="space-y-4">
        {fields.map((f) => {
          const id = `${f.key}_${lang}`
          return (
            <div key={id}>
              <label className="label" htmlFor={id}>
                {f.label} <span className="font-normal text-slate-400">({lang.toUpperCase()})</span>
              </label>
              {f.multiline ? (
                <textarea id={id} rows={f.rows ?? 5} className="input" value={values[id] ?? ''} onChange={(e) => onChange(id, e.target.value)} />
              ) : (
                <input id={id} className={cn('input', error && f === fields[0] && 'input-error')} value={values[id] ?? ''} onChange={(e) => onChange(id, e.target.value)} />
              )}
            </div>
          )
        })}
        {error ? <p className="text-xs text-rose-600">{error}</p> : <p className="text-xs text-slate-500">{t('admin.form.translationsHint')}</p>}
      </div>
    </div>
  )
}

/** Uploads a file to /api/uploads and reports back the stored URL. */
export function FileUpload({
  value,
  onChange,
  kind = 'image',
  label,
}: {
  value: string | null
  onChange: (url: string | null) => void
  kind?: 'image' | 'document'
  label: string
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)
  const upload = useMutation({ mutationFn: (file: File) => api.upload(file, kind), onSuccess: (r) => onChange(r.url) })
  const isImage = value && /\.(jpe?g|png|webp|gif)$/i.test(value)

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3">
          {isImage ? (
            <img src={value} alt="" className="h-24 w-40 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand-700 underline">
              <FileText className="size-4" /> {value.split('/').pop()}
            </a>
          )}
          <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => onChange(null)}>
            <Trash2 className="size-4" /> {t('admin.form.remove')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => ref.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? (
            <>
              <Spinner /> {t('admin.form.uploading')}
            </>
          ) : (
            <>
              <ImagePlus className="size-4" /> {label}
            </>
          )}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={kind === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'image/jpeg,image/png,image/webp,application/pdf'}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
      {upload.isError && <p className="mt-1 text-xs text-rose-600">{errorMessage(upload.error, t)}</p>}
    </div>
  )
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
