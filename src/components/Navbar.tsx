import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Pill, GitCompareArrows, Apple, Menu, X, LogOut, PlusCircle, AlertOctagon, Settings as SettingsIcon } from 'lucide-react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useMemo, useState } from 'react';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { TranslationKey } from '@/features/settings/translations';

const navByRole: Record<UserRole, Array<{ to: string; labelKey: TranslationKey; icon: React.ElementType }>> = {
  patient: [
    { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/add-medicine', labelKey: 'nav.add', icon: PlusCircle },
    { to: '/medicines', labelKey: 'nav.medicines', icon: Pill },
    { to: '/interaction-checker', labelKey: 'nav.interactions', icon: GitCompareArrows },
    { to: '/food-check', labelKey: 'nav.foodCheck', icon: Apple },
    { to: '/missed-doses', labelKey: 'nav.missedDoses', icon: AlertOctagon },
    { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
  ],
  caretaker: [
    { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/add-medicine', labelKey: 'nav.addForPatient', icon: PlusCircle },
    { to: '/medicines', labelKey: 'nav.patientMedicines', icon: Pill },
    { to: '/interaction-checker', labelKey: 'nav.interactions', icon: GitCompareArrows },
    { to: '/food-check', labelKey: 'nav.foodCheck', icon: Apple },
    { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
  ],
};

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const { t } = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = useMemo(() => {
    if (!user) return [];
    return navByRole[user.role] || [];
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="gradient-primary rounded-lg p-1.5">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">{t('app.brand')}</span>
        </Link>

        {isAuthenticated && (
          <>
            <div className="hidden items-center gap-1 md:flex">
              {navItems.map(({ to, labelKey, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === to
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey)}
                </Link>
              ))}
            </div>
            <div className="hidden md:flex">
              <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </button>
            </div>
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </>
        )}

        {!isAuthenticated && (
          <Link to="/auth" className="gradient-primary rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            {t('auth.signIn')}
          </Link>
        )}
      </div>

      {mobileOpen && isAuthenticated && (
        <div className="border-t border-border bg-card p-4 md:hidden">
          {navItems.map(({ to, labelKey, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          ))}
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-destructive hover:bg-muted">
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
