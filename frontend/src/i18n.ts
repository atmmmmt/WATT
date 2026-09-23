import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLanguage, landingCopy } from './landing-content';

const resources = Object.fromEntries(
  Object.entries(landingCopy).map(([language, copy]) => [
    language,
    {
      translation: {
        nav: copy.nav,
        seo: copy.seo,
        hero: copy.hero,
        footer: copy.footer,
      },
    },
  ]),
);

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
