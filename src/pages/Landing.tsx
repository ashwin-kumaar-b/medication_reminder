import { Link } from 'react-router-dom';
import { Shield, Clock, GitCompareArrows, Apple, Brain, ArrowRight, Pill, Heart } from 'lucide-react';

const features = [
  { icon: Clock, title: 'Dose Reminders', desc: 'Never miss a dose with smart, timely reminders tailored to your schedule.' },
  { icon: GitCompareArrows, title: 'Drug Interaction Checker', desc: 'Instantly check if your medications are safe to take together.' },
  { icon: Apple, title: 'Food Compatibility', desc: 'Know which foods to avoid with your medications.' },
  { icon: Brain, title: 'AI-Powered Decisions', desc: '"Can I Take Now?" — real-time safety checks before every dose.' },
];

const Landing = () => (
  <div className="flex min-h-screen flex-col">
    {/* Hero */}
    <section className="gradient-hero relative overflow-hidden">
      <div className="container mx-auto flex flex-col items-center px-4 py-20 text-center md:py-32">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-4 py-1.5">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-accent-foreground">Trusted by thousands of patients</span>
        </div>
        <h1 className="mb-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
          Smart Medication Intelligence for{' '}
          <span className="gradient-primary bg-clip-text text-transparent">Safer Lives</span>
        </h1>
        <p className="mb-8 max-w-xl text-lg text-muted-foreground">
          MediGuard AI helps you manage medications, check drug interactions, and make informed decisions — all in one place.
        </p>
        <div className="flex gap-3">
          <Link to="/auth" className="gradient-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-primary-foreground shadow-elevated transition-opacity hover:opacity-90">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#features" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted">
            Learn More
          </a>
        </div>
        {/* Floating icons */}
        <div className="pointer-events-none absolute -top-4 left-10 animate-pulse-gentle opacity-20">
          <Pill className="h-24 w-24 text-primary" />
        </div>
        <div className="pointer-events-none absolute bottom-10 right-10 animate-pulse-gentle opacity-15">
          <Heart className="h-20 w-20 text-secondary" />
        </div>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-primary">Features</h2>
        <p className="mb-12 text-center text-3xl font-bold text-foreground">Everything You Need</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-elevated">
              <div className="mb-4 inline-flex rounded-lg bg-accent p-3 text-primary transition-colors group-hover:gradient-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="gradient-primary py-16">
      <div className="container mx-auto flex flex-col items-center px-4 text-center">
        <h2 className="mb-4 text-3xl font-bold text-primary-foreground">Ready to Take Control of Your Health?</h2>
        <p className="mb-6 max-w-md text-primary-foreground/80">Join MediGuard AI today and never worry about medication safety again.</p>
        <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted">
          Get Started Free <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  </div>
);

export default Landing;
