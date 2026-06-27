import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./store/app";
import { ActivityProvider } from "./components/Activity";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ActivityProvider>
          <App />
        </ActivityProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
