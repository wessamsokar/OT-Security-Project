import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RootRecovery } from "./components/RootRecovery";
import { AuthProvider } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import "./styles/index.css";

const startTs = performance.now();
console.groupCollapsed("[startup] react mount");
console.time("startup:root_render");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootRecovery>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <TenantProvider>
              <App />
            </TenantProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </RootRecovery>
  </React.StrictMode>
);

console.timeEnd("startup:root_render");
console.info("[startup] root render ms", Math.round(performance.now() - startTs));
console.groupEnd();
