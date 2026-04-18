import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadLocalMedicineData } from "@/lib/localMedicineData";

void preloadLocalMedicineData();

createRoot(document.getElementById("root")!).render(<App />);
