import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Search, CheckCircle2, ArrowRight, Info, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const CaretakerPortal = () => {
  const { user, users, getLinkedPatients, linkExistingPatient } = useAuth();
  const { toast } = useToast();
  
  const [patientIdInput, setPatientIdInput] = useState('');
  const [linking, setLinking] = useState(false);

  // If not a caretaker, push back to dashboard or login
  if (!user) return <Navigate to="/auth" />;
  if (user.role !== 'caretaker') return <Navigate to="/dashboard" />;

  const linkedPatients = getLinkedPatients(user.id);
  const profile = users.find(u => u.id === user.id) || user;

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdInput.trim()) return;

    setLinking(true);
    const result = await linkExistingPatient(user.id, patientIdInput);
    setLinking(false);

    if (result.ok && result.patient) {
      toast({
        title: 'Patient Linked',
        description: `Successfully linked ${result.patient.name} to your portal.`,
      });
      setPatientIdInput('');
    } else {
      toast({
        title: 'Link Failed',
        description: result.error || 'Could not link patient.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-fade-in space-y-8">
      <div className="flex flex-col gap-1 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Caretaker Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.name}. Manage your linked patients here.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Link Patient Form */}
        <Card className="col-span-1 h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="rounded-t-xl border-b border-slate-200/80 bg-white pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Plus className="h-5 w-5" /> Link New Patient
            </CardTitle>
            <CardDescription>
              Enter the unique Patient ID (MGP-XXXXXX) found in their settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleLinkPatient} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Patient ID</label>
                <Input
                  placeholder="e.g., MGP-A1B2C3"
                  value={patientIdInput}
                  onChange={(e) => setPatientIdInput(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 bg-slate-50 font-mono uppercase placeholder:normal-case"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="min-h-12 w-full rounded-xl bg-[#008080] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#006f67]"
                disabled={linking || !patientIdInput.trim()}
              >
                {linking ? 'Linking...' : 'Link Patient Account'}
              </Button>
            </form>

            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p>Patients can find their ID in</p>
                  <span className="mt-1 inline-block font-semibold text-foreground">Settings &gt; My Profile</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Linked Patients Grid */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linked Patients</p>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              {linkedPatients.length}
            </span>
          </div>

          {linkedPatients.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground bg-accent/30 rounded-xl border border-dashed border-border min-h-[300px]">
              <Search className="h-10 w-10 mb-3 text-muted-foreground/40" />
              <h3 className="text-base font-semibold text-foreground mb-1">No patients linked yet</h3>
              <p className="text-sm max-w-sm">Use the form to link a patient using their unique ID to start managing their medications.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {linkedPatients.map((patient) => (
                <Card key={patient.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                  <CardContent className="p-5 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[16px] font-semibold text-foreground group-hover:text-primary transition-colors">
                          {patient.name}
                        </h3>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Linked
                        </span>
                      </div>
                      
                      <div className="mt-4 grid gap-2 text-sm">
                        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-muted-foreground">Patient ID</span>
                          <span className="font-mono text-foreground">{patient.patientId || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-muted-foreground">Age</span>
                          <span className="text-foreground">{patient.age ? `${patient.age} yrs` : 'Not specified'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-muted-foreground">Condition</span>
                          <span className="max-w-[160px] truncate text-right text-foreground" title={patient.illness}>
                            {patient.illness || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" asChild className="text-xs text-foreground">
                        <Link to={`/add-medicine?patientId=${patient.id}`}>Manage Medicines</Link>
                      </Button>
                      <Button variant="default" size="sm" asChild className="text-xs bg-[#008080] text-white hover:bg-[#006f67]">
                        <Link to="/medicines">View Details <ArrowRight className="ml-1 w-3 h-3" /></Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-border">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Caretaker Account Details</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Caretaker ID</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-mono font-medium text-teal-800">
              {profile?.caretakerId || user.caretakerId || 'N/A'}
              <button
                type="button"
                onClick={() => {
                  const id = profile?.caretakerId || user.caretakerId || '';
                  if (!id) return;
                  navigator.clipboard.writeText(id);
                  toast({ title: 'ID Copied', description: 'Caretaker ID copied to clipboard.', duration: 2000 });
                }}
                className="rounded-full p-1 text-teal-600 hover:bg-teal-200 hover:text-teal-900"
                aria-label="Copy caretaker ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium text-foreground">{profile?.name}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Relation</span>
              <span className="text-sm font-medium capitalize text-foreground">{profile?.relation || 'N/A'}</span>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Mobile</span>
              <span className="text-sm font-medium text-foreground">{profile?.phoneNumber || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaretakerPortal;