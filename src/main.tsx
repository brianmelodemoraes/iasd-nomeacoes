import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import Participante from "./pages/Participante";

const Telao = lazy(() => import("./pages/Telao"));
const Admin = lazy(() => import("./pages/Admin"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/telao/:codigo" element={<Telao />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Participante />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
