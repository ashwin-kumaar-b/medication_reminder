export type AppLanguage = 'en' | 'es' | 'fr';

export type TranslationKey =
  | 'app.brand'
  | 'nav.dashboard'
  | 'nav.add'
  | 'nav.addForPatient'
  | 'nav.medicines'
  | 'nav.patientMedicines'
  | 'nav.interactions'
  | 'nav.foodCheck'
  | 'nav.canITake'
  | 'nav.missedDoses'
  | 'nav.settings'
  | 'auth.signIn'
  | 'auth.logout'
  | 'settings.title'
  | 'settings.subtitle'
  | 'settings.language'
  | 'settings.sound'
  | 'settings.volume'
  | 'settings.preview'
  | 'settings.english'
  | 'settings.spanish'
  | 'settings.french'
  | 'settings.soundClassic'
  | 'settings.soundSoft'
  | 'settings.soundUrgent';

export const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'app.brand': 'MediGuard AI',
    'nav.dashboard': 'Dashboard',
    'nav.add': 'Add',
    'nav.addForPatient': 'Add for Patient',
    'nav.medicines': 'Medicines',
    'nav.patientMedicines': 'Patient Medicines',
    'nav.interactions': 'Interactions',
    'nav.foodCheck': 'Food Check',
    'nav.canITake': 'Can I Take',
    'nav.missedDoses': 'Missed Doses',
    'nav.settings': 'Settings',
    'auth.signIn': 'Sign In',
    'auth.logout': 'Logout',
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage language and reminder preferences.',
    'settings.language': 'Language',
    'settings.sound': 'Notification Sound',
    'settings.volume': 'Reminder Volume',
    'settings.preview': 'Play Preview',
    'settings.english': 'English',
    'settings.spanish': 'Spanish',
    'settings.french': 'French',
    'settings.soundClassic': 'Classic',
    'settings.soundSoft': 'Soft',
    'settings.soundUrgent': 'Urgent',
  },
  es: {
    'app.brand': 'MediGuard AI',
    'nav.dashboard': 'Panel',
    'nav.add': 'Agregar',
    'nav.addForPatient': 'Agregar para paciente',
    'nav.medicines': 'Medicinas',
    'nav.patientMedicines': 'Medicinas del paciente',
    'nav.interactions': 'Interacciones',
    'nav.foodCheck': 'Comida',
    'nav.canITake': 'Puedo tomar',
    'nav.missedDoses': 'Dosis perdidas',
    'nav.settings': 'Configuracion',
    'auth.signIn': 'Iniciar sesion',
    'auth.logout': 'Cerrar sesion',
    'settings.title': 'Configuracion',
    'settings.subtitle': 'Administra idioma y recordatorios.',
    'settings.language': 'Idioma',
    'settings.sound': 'Sonido de notificacion',
    'settings.volume': 'Volumen del recordatorio',
    'settings.preview': 'Probar sonido',
    'settings.english': 'Ingles',
    'settings.spanish': 'Espanol',
    'settings.french': 'Frances',
    'settings.soundClassic': 'Clasico',
    'settings.soundSoft': 'Suave',
    'settings.soundUrgent': 'Urgente',
  },
  fr: {
    'app.brand': 'MediGuard AI',
    'nav.dashboard': 'Tableau',
    'nav.add': 'Ajouter',
    'nav.addForPatient': 'Ajouter patient',
    'nav.medicines': 'Medicaments',
    'nav.patientMedicines': 'Medicaments patient',
    'nav.interactions': 'Interactions',
    'nav.foodCheck': 'Controle aliments',
    'nav.canITake': 'Puis-je prendre',
    'nav.missedDoses': 'Doses manquees',
    'nav.settings': 'Parametres',
    'auth.signIn': 'Connexion',
    'auth.logout': 'Deconnexion',
    'settings.title': 'Parametres',
    'settings.subtitle': 'Gerer la langue et les rappels.',
    'settings.language': 'Langue',
    'settings.sound': 'Son de notification',
    'settings.volume': 'Volume du rappel',
    'settings.preview': 'Tester le son',
    'settings.english': 'Anglais',
    'settings.spanish': 'Espagnol',
    'settings.french': 'Francais',
    'settings.soundClassic': 'Classique',
    'settings.soundSoft': 'Doux',
    'settings.soundUrgent': 'Urgent',
  },
};
