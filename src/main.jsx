import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./styles/globals.css";
import { router } from "./router.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
);
