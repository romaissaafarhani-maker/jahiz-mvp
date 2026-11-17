import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import fr from './fr.json';

export type Langue = 'ar' | 'fr';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { ar: { translation: ar }, fr: { translation: fr } },
    lng: 'ar', // Arabe (RTL) par défaut
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });
}

/** Applique la langue ET la direction à document (RTL par défaut). */
export function appliquerLangue(langue: Langue): void {
  void i18n.changeLanguage(langue);
  document.documentElement.lang = langue;
  document.documentElement.dir = langue === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;
