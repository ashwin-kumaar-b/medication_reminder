import { useRef } from 'react';
import { AppLanguage } from '@/features/settings/translations';
import { NotificationSound, useAppSettings } from '@/features/settings/SettingsContext';

const SettingsPanel = () => {
  const { settings, setLanguage, setNotificationSound, setNotificationVolume, t } = useAppSettings();
  const audioContextRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const languageOptions: Array<{ value: AppLanguage; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Espanol' },
    { value: 'fr', label: 'Francais' },
    { value: 'ta', label: 'Tamil' },
    { value: 'te', label: 'Telugu' },
    { value: 'hi', label: 'Hindi' },
  ];

  const playPreview = () => {
    if (settings.notificationSound === 'cherie') {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio('/sounds/cherie-reminder.mp3');
      }
      previewAudioRef.current.volume = settings.notificationVolume;
      previewAudioRef.current.currentTime = 0;
      void previewAudioRef.current.play();
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = settings.notificationSound === 'soft' ? 'triangle' : 'sine';
        oscillator.frequency.value = freq;
        gain.gain.value = settings.notificationVolume;
        oscillator.connect(gain);
        gain.connect(context.destination);
        const startAt = context.currentTime + startOffset;
        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
      };

      if (settings.notificationSound === 'urgent') {
        playTone(950, 0, 0.2);
        playTone(760, 0.23, 0.2);
      } else if (settings.notificationSound === 'soft') {
        playTone(620, 0, 0.35);
      } else {
        playTone(880, 0, 0.25);
      }
    } catch {
      // No-op for audio errors.
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{t('settings.language')}</label>
          <select
            value={settings.language}
            onChange={e => setLanguage(e.target.value as AppLanguage)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
          >
            {languageOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{t('settings.sound')}</label>
          <select
            value={settings.notificationSound}
            onChange={e => setNotificationSound(e.target.value as NotificationSound)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
          >
            <option value="classic">{t('settings.soundClassic')}</option>
            <option value="soft">{t('settings.soundSoft')}</option>
            <option value="urgent">{t('settings.soundUrgent')}</option>
            <option value="cherie">{t('settings.soundCherie')}</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{t('settings.volume')}</label>
          <input
            type="range"
            min={0.02}
            max={0.2}
            step={0.01}
            value={settings.notificationVolume}
            onChange={e => setNotificationVolume(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          type="button"
          onClick={playPreview}
          className="gradient-primary rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t('settings.preview')}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
