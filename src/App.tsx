import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MedicineProvider } from "@/contexts/MedicineContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import AddMedicine from "@/pages/AddMedicine";
import EditMedicine from "@/pages/EditMedicine";
import Medicines from "@/pages/Medicines";
import InteractionChecker from "@/pages/InteractionChecker";
import FoodCheck from "@/pages/FoodCheck";
import MissedDoses from "@/pages/MissedDoses";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import { SettingsProvider } from "@/features/settings/SettingsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SettingsProvider>
        <MedicineProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>

              {/* Only show Navbar and Footer if not on /auth route */}
              <Routes>
                <Route
                  path="/auth"
                  element={
                    <main className="flex-1">
                      <Auth />
                    </main>
                  }
                />
                <Route
                  path="*"
                  element={
                    <div className="flex min-h-screen flex-col">
                      <Navbar />
                      <main className="flex-1">
                        <Routes>
                          <Route path="/" element={<Landing />} />
                          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                          <Route path="/add-medicine" element={<ProtectedRoute allowRoles={['patient', 'caretaker']}><AddMedicine /></ProtectedRoute>} />
                          <Route path="/edit-medicine/:id" element={<ProtectedRoute allowRoles={['patient', 'caretaker']}><EditMedicine /></ProtectedRoute>} />
                          <Route path="/medicines" element={<ProtectedRoute><Medicines /></ProtectedRoute>} />
                          <Route path="/interaction-checker" element={<ProtectedRoute><InteractionChecker /></ProtectedRoute>} />
                          <Route path="/food-check" element={<ProtectedRoute><FoodCheck /></ProtectedRoute>} />
                          <Route path="/missed-doses" element={<ProtectedRoute allowRoles={['patient']}><MissedDoses /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                      <Footer />
                    </div>
                  }
                />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MedicineProvider>
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
