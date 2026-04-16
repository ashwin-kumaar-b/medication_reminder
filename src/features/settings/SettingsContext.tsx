import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { AppLanguage, translations, TranslationKey } from '@/features/settings/translations';

export type NotificationSound = 'classic' | 'soft' | 'urgent' | 'cherie';

export interface AppSettings {
  language: AppLanguage;
  notificationSound: NotificationSound;
  notificationVolume: number;
}

interface SettingsContextType {
  settings: AppSettings;
  setLanguage: (language: AppLanguage) => void;
  setNotificationSound: (sound: NotificationSound) => void;
  setNotificationVolume: (volume: number) => void;
  t: (key: TranslationKey) => string;
}

const defaultSettings: AppSettings = {
  language: 'en',
  notificationSound: 'classic',
  notificationVolume: 0.08,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem('mediguard_app_settings');
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        language: parsed.language || defaultSettings.language,
        notificationSound: parsed.notificationSound || defaultSettings.notificationSound,
        notificationVolume: typeof parsed.notificationVolume === 'number' ? parsed.notificationVolume : defaultSettings.notificationVolume,
      };
    } catch {
      return defaultSettings;
    }
  });

  const updateSettings = (next: AppSettings) => {
    setSettings(next);
    localStorage.setItem('mediguard_app_settings', JSON.stringify(next));
  };

  const value = useMemo<SettingsContextType>(() => {
    const t = (key: TranslationKey) => translations[settings.language]?.[key] || translations.en[key] || key;

    return {
      settings,
      setLanguage: language => updateSettings({ ...settings, language }),
      setNotificationSound: notificationSound => updateSettings({ ...settings, notificationSound }),
      setNotificationVolume: notificationVolume => updateSettings({ ...settings, notificationVolume }),
      t,
    };
  }, [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useAppSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within SettingsProvider');
  return ctx;
};
