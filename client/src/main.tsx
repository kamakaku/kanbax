import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Debug: Test if React is working at all
console.log("React main.tsx is loading...");

try {
  const rootElement = document.getElementById("root");
  console.log("Root element found:", rootElement);
  
  if (rootElement) {
    createRoot(rootElement).render(<App />);
    console.log("React app rendered successfully");
  } else {
    console.error("Root element not found!");
  }
} catch (error) {
  console.error("Error rendering React app:", error);
}
