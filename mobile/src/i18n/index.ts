import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import mr from './locales/mr.json';
import ml from './locales/ml.json';

const LANGUAGE_KEY = '@saferide:language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ml', label: 'മലയാളം' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

export async function getStoredLanguage(): Promise<LanguageCode | null> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
    return stored as LanguageCode;
  }
  return null;
}

export async function setStoredLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
}

function detectLocale(): string {
  const locales = getLocales();
  if (locales.length > 0) {
    const tag = locales[0]?.languageTag ?? 'en';
    const lang = tag.split('-')[0] ?? 'en';
    if (SUPPORTED_LANGUAGES.some(l => l.code === lang)) return lang;
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    lng: detectLocale(),
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      kn: { translation: kn },
      ta: { translation: ta },
      te: { translation: te },
      mr: { translation: mr },
      ml: { translation: ml },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Apply stored preference asynchronously
void getStoredLanguage().then(stored => {
  if (stored) void i18n.changeLanguage(stored);
});

export default i18n;
