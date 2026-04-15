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
import Medicines from "@/pages/Medicines";
import InteractionChecker from "@/pages/InteractionChecker";
import FoodCheck from "@/pages/FoodCheck";
import CanITake from "@/pages/CanITake";
import MissedDoses from "@/pages/MissedDoses";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MedicineProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/add-medicine" element={<ProtectedRoute><AddMedicine /></ProtectedRoute>} />
                  <Route path="/medicines" element={<ProtectedRoute><Medicines /></ProtectedRoute>} />
                  <Route path="/interaction-checker" element={<ProtectedRoute><InteractionChecker /></ProtectedRoute>} />
                  <Route path="/food-check" element={<ProtectedRoute><FoodCheck /></ProtectedRoute>} />
                  <Route path="/can-i-take" element={<ProtectedRoute><CanITake /></ProtectedRoute>} />
                  <Route path="/missed-doses" element={<ProtectedRoute><MissedDoses /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </MedicineProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
