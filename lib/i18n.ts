import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import it from '@/locales/it.json';
import nl from '@/locales/nl.json';

const resources = {
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  nl: { translation: nl },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'de',
    fallbackLng: 'de',
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
