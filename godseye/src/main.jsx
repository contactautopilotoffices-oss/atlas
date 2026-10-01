import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import Gate from "./components/Gate.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { TooltipProvider } from "./components/Tooltip.jsx";

function App() {
  const [session, setSession] = useState(null); // { key, server }
  const handleOpen = useCallback((key, server) => setSession({ key, server }), []);
  if (!session) return <Gate onOpen={handleOpen} />;
  return (
    <TooltipProvider>
      <Dashboard accessKey={session.key} server={session.server} />
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
