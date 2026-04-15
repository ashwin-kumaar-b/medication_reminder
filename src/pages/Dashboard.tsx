import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMedicines } from '@/contexts/MedicineContext';
import { Pill, Clock, AlertTriangle, Plus, GitCompareArrows, HelpCircle, XCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { medicines, doseLogs } = useMedicines();

  const activeMeds = medicines.filter(m => m.isActive);
  const missedDoses = doseLogs.filter(l => l.status === 'missed').length;
  const takenToday = doseLogs.filter(l => l.status === 'taken' && new Date(l.scheduledTime).toDateString() === new Date().toDateString()).length;

  const cards = [
    { label: 'Active Medicines', value: activeMeds.length, icon: Pill, color: 'text-primary bg-accent' },
    { label: 'Doses Taken Today', value: takenToday, icon: Clock, color: 'text-success bg-success/10' },
    { label: 'Missed Doses', value: missedDoses, icon: XCircle, color: 'text-destructive bg-destructive/10' },
    { label: 'Total Medicines', value: medicines.length, icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  ];

  const actions = [
    { to: '/add-medicine', label: 'Add Medicine', icon: Plus, desc: 'Add a new medication to your list' },
    { to: '/interaction-checker', label: 'Check Interactions', icon: GitCompareArrows, desc: 'Verify drug safety' },
    { to: '/can-i-take', label: 'Can I Take Now?', icon: HelpCircle, desc: 'Real-time dose safety check' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.name || 'User'} 👋</h1>
        <p className="text-muted-foreground">Here's your medication overview for today.</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
          <div key={label} className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {actions.map(({ to, label, icon: Icon, desc }) => (
          <Link key={to} to={to} className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated">
            <div className="rounded-lg gradient-primary p-2.5 text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary">{label}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
