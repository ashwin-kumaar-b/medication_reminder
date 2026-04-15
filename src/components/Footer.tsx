import { Shield } from 'lucide-react';

const Footer = () => (
  <footer className="border-t border-border bg-card py-6">
    <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-center">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">MediGuard AI</span>
      </div>
      <p className="text-xs text-muted-foreground">© 2025 — Not a substitute for medical advice</p>
    </div>
  </footer>
);

export default Footer;
