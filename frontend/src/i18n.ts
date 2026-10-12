import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ky from './locales/ky/translation.json'
import ru from './locales/ru/translation.json'
import en from './locales/en/translation.json'

export const LANGUAGES = ['ky', 'ru', 'en'] as const
export type Lang = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'iku_lang'

function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Lang
  } catch {
    /* storage unavailable */
  }
  const browser = navigator.language.slice(0, 2)
  return (LANGUAGES as readonly string[]).includes(browser) ? (browser as Lang) : 'ru'
}

i18n.use(initReactI18next).init({
  resources: { ky: { translation: ky }, ru: { translation: ru }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'ru',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes
})

// Language switches are instant (no reload); remember the choice for anonymous visitors.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* storage unavailable */
  }
})
document.documentElement.lang = i18n.language

export const currentLang = () => (i18n.resolvedLanguage ?? 'ru') as Lang

export default i18n
