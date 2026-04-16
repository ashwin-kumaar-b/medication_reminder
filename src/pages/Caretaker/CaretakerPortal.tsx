import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Search, LogOut, CheckCircle2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const CaretakerPortal = () => {
  const { user, users, logout, getLinkedPatients, linkExistingPatient } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [patientIdInput, setPatientIdInput] = useState('');
  const [linking, setLinking] = useState(false);

  // If not a caretaker, push back to dashboard or login
  if (!user) return <Navigate to="/auth" />;
  if (user.role !== 'caretaker') return <Navigate to="/dashboard" />;

  const linkedPatients = getLinkedPatients(user.id);
  const profile = users.find(u => u.id === user.id) || user;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent">
            Caretaker Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.name}. Manage your linked patients here.
          </p>
        </div>
        
        <div className="flex gap-4">
          <Button variant="destructive" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Link Patient Form */}
        <Card className="col-span-1 border-teal-100 shadow-md h-fit">
          <CardHeader className="bg-teal-50/50 rounded-t-xl border-b border-teal-100/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-teal-800 text-lg">
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
                  className="font-mono uppercase placeholder:normal-case h-11"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm transition-colors py-5"
                disabled={linking || !patientIdInput.trim()}
              >
                {linking ? 'Linking...' : 'Link Patient Account'}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50">
              <p>Patients can find their ID in</p>
              <span className="font-semibold text-foreground mt-1 inline-block">Settings &gt; My Profile</span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Linked Patients Grid */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" /> Linked Patients
              <span className="bg-indigo-100 text-indigo-700 text-xs py-0.5 px-2 rounded-full font-bold ml-2">
                {linkedPatients.length}
              </span>
            </h2>
          </div>

          {linkedPatients.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground bg-accent/30 rounded-xl border border-dashed border-border min-h-[300px]">
              <Search className="h-10 w-10 mb-3 text-muted-foreground/40" />
              <h3 className="text-base font-semibold text-foreground mb-1">No patients linked yet</h3>
              <p className="text-sm max-w-sm">Use the form to link a patient using their unique ID to start managing their medications.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {linkedPatients.map(patient => (
                <Card key={patient.id} className="group transition-all hover:border-primary hover:shadow-md">
                  <CardContent className="p-5 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                          {patient.name}
                        </h3>
                        <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-1 rounded-md font-medium">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Linked
                        </span>
                      </div>
                      
                      <div className="space-y-1.5 mt-4 text-sm text-muted-foreground">
                        <div className="flex justify-between border-b pb-1">
                          <span>Patient ID:</span>
                          <span className="font-mono text-foreground">{patient.patientId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span>Age:</span>
                          <span className="text-foreground">{patient.age ? `${patient.age} yrs` : 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Condition:</span>
                          <span className="text-foreground truncate max-w-[120px]" title={patient.illness}>
                            {patient.illness || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" asChild className="text-xs group-hover:border-primary/30">
                        <Link to={`/add-medicine?patientId=${patient.id}`}>Add Medicine</Link>
                      </Button>
                      <Button variant="default" size="sm" asChild className="text-xs bg-primary hover:bg-primary/90">
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Caretaker Account Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Caretaker ID</span>
            <span className="font-mono text-sm tracking-tight font-medium bg-muted px-2 py-1 rounded select-all">{profile?.caretakerId || user.caretakerId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Name</span>
            <span className="font-medium text-sm">{profile?.name}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Relation</span>
            <span className="font-medium text-sm capitalize">{profile?.relation || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Phone Number</span>
            <span className="font-medium text-sm truncate">{profile?.phoneNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaretakerPortal;