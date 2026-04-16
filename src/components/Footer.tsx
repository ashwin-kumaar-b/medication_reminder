import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Footer = () => {
  const { user } = useAuth();

  const links = user?.role === 'caretaker'
    ? [
        { to: '/caretaker', label: 'Caretaker Dashboard' },
        { to: '/medicines', label: 'Patient Medicines' },
        { to: '/interaction-checker', label: 'Interaction Check' },
      ]
    : [
        { to: '/dashboard', label: 'Patient Dashboard' },
        { to: '/missed-doses', label: 'Missed Dose Analyzer' },
      ];

  return (
    <footer className="border-t border-border bg-card py-6">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 text-center">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">MediGuard AI</span>
        </div>
        {user && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            {links.map(link => (
              <Link key={link.to} to={link.to} className="text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">© 2026 — This system supports adherence tracking and does not replace medical advice</p>
      </div>
    </footer>
  );
};

export default Footer;
