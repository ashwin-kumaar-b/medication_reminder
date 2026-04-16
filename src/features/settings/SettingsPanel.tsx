import { useRef, useState } from 'react';
import { AppLanguage } from '@/features/settings/translations';
import { NotificationSound, useAppSettings } from '@/features/settings/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, RefreshCw, Smartphone, UserCircle, Droplet, User as UserIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';

const SettingsPanel = () => {
  const { user, regeneratePatientId } = useAuth();
  const { settings, setLanguage, setNotificationSound, setNotificationVolume, t } = useAppSettings();
  const { toast } = useToast();
  const [regenerating, setRegenerating] = useState(false);
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
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {user?.role === 'patient' && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-elevated animate-fade-in">
          <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" /> My Profile
          </h2>

          {user.patientId && (
            <div className="mb-6 flex flex-col items-center justify-center rounded-xl bg-muted/40 p-6">
              <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
                <QRCode value={user.patientId} size={140} />
              </div>
              <p className="mb-3 text-sm text-muted-foreground text-center">
                Scan or share this code with your caretaker
              </p>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-teal-800">
                  <span className="text-sm font-semibold tracking-wide">{user.patientId}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.patientId!);
                      toast({ title: 'ID Copied', description: 'Patient ID copied to clipboard.', duration: 2000 });
                    }}
                    className="rounded-full p-1 text-teal-600 transition-colors hover:bg-teal-200 hover:text-teal-900"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                
                <button
                  disabled={regenerating}
                  onClick={async () => {
                    if (!window.confirm("Regenerating will disconnect existing caretakers. Are you sure?")) return;
                    setRegenerating(true);
                    await regeneratePatientId(user.id);
                    setRegenerating(false);
                    toast({ title: 'ID Regenerated', description: 'Your Patient ID has been updated.' });
                  }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
                  title="Regenerating will disconnect existing caretakers."
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate ID
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Full Name
              </p>
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
            </div>
            
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> Mobile Details
              </p>
              <p className="text-sm font-semibold text-foreground">{user.phoneNumber || user.email}</p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Gender
              </p>
              <p className="text-sm font-semibold text-foreground">
                {user.gender || 'Not specified'} {user.genderOther ? `(${user.genderOther})` : ''}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Droplet className="h-3 w-3" /> Blood Group
              </p>
              <p className="text-sm font-semibold text-foreground">{user.bloodGroup || 'Not specified'}</p>
            </div>

            <div className="rounded-lg border border-border p-3 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Date of Birth
              </p>
              <p className="text-sm font-semibold text-foreground">{user.dateOfBirth || 'Not specified'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-elevated animate-fade-in">
        <h2 className="mb-4 text-lg font-semibold text-foreground">App Preferences</h2>
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
