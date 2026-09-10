import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyDocumentLocale, getMessages, localeFromWindow } from "./i18n";
import "./styles.css";

const initialLocale = localeFromWindow();
applyDocumentLocale(initialLocale, getMessages(initialLocale));

createRoot(document.getElementById("root")!).render(
  <App />
);
