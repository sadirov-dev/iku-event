import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '../i18n'

/** Order to try when the requested translation is missing — never show an empty block. */
const FALLBACK: Lang[] = ['ru', 'ky', 'en']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translatable = Record<string, any> | null | undefined

export function localize(obj: Translatable, field: string, lang: Lang): string {
  if (!obj) return ''
  for (const l of [lang, ...FALLBACK]) {
    const value = obj[`${field}_${l}`]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

/** `const L = useLocalize(); L(event, 'title')` — picks the current UI language with fallback. */
export function useLocalize() {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? 'ru') as Lang
  return useCallback((obj: Translatable, field: string) => localize(obj, field, lang), [lang])
}
