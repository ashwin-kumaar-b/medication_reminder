import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, ShieldAlert, Users, Clock3, Pill, Activity } from 'lucide-react';

const features = [
  {
    icon: BellRing,
    title: 'Intelligent Reminders',
    desc: 'Escalating reminders adapt when a dose is not marked in time.',
  },
  {
    icon: Clock3,
    title: 'Risk Escalation Timeline',
    desc: 'Rule-based timeline shows how delayed or missed doses can increase risk state.',
  },
  {
    icon: Users,
    title: 'Caretaker Monitoring',
    desc: 'Caretakers receive focused alerts for high criticality and repeated misses.',
  },
  {
    icon: ShieldAlert,
    title: 'Drug Interaction Alerts',
    desc: 'Potential interaction patterns are highlighted as medications are added.',
  },
];

const steps = [
  { title: 'Add Medication', desc: 'Capture dosage, category, schedule, and criticality level.' },
  { title: 'Track & Monitor', desc: 'Mark Taken, Delayed, or Skipped and view adherence stability in real time.' },
  { title: 'Prevent Risk', desc: 'Risk indicator escalates and caretaker receives alerts when needed.' },
];

const Landing = () => (
  <div className="flex min-h-screen flex-col bg-background">
    <section className="gradient-hero relative overflow-hidden">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/90 px-4 py-2 text-sm font-semibold text-primary shadow-card">
            <Activity className="h-4 w-4" />
            Intelligent Medication Risk Monitoring System
          </div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            Smart Medication Monitoring for Chronic Care
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Track adherence, detect risk buildup from non-adherence, and notify caretakers before missed doses become critical.
          </p>
          <Link
            to="/auth"
            className="gradient-primary inline-flex items-center gap-2 rounded-xl px-7 py-3 text-lg font-semibold text-primary-foreground shadow-elevated transition-opacity hover:opacity-90"
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <Pill className="pointer-events-none absolute -left-6 top-10 h-28 w-28 text-primary/15" />
      <ShieldAlert className="pointer-events-none absolute -right-8 bottom-8 h-32 w-32 text-secondary/20" />
    </section>

    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-foreground">Features</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 inline-flex rounded-lg bg-accent p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="border-y border-border bg-card/60 py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-foreground">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-border bg-background p-6 shadow-card">
              <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mb-2 text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="py-10">
      <p className="text-center text-sm font-medium text-muted-foreground">
        This application does not replace professional medical advice.
      </p>
    </section>
  </div>
);

export default Landing;
