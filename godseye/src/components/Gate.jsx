import React, { useEffect, useState } from "react";
import { Rise } from "cube-motion/react";
import { ping } from "../lib/api.js";
import { storage } from "../lib/storage.js";

/* Passcode gate. The key is checked by the server on every desk call; this
   screen only collects it. A key saved for this browser tab is retried
   silently on load. */
export default function Gate({ onOpen }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const saved = storage.get("ge-key", "", "session");
    if (saved) ping(saved).then((r) => { if (r.status === 200) onOpen(saved, r); }).catch(() => {});
  }, [onOpen]);

  const handleSubmit = async () => {
    const k = key.trim();
    if (!k || checking) return;
    setChecking(true); setError("");
    try {
      const r = await ping(k);
      if (r.status === 200) { storage.set("ge-key", k, "session"); onOpen(k, r); return; }
      setError(r.status === 401 ? "Not recognised. Access is issued per person." : r.error || "Server error " + r.status);
    } catch {
      setError("Could not reach the server.");
    }
    setChecking(false);
  };

  return (
    <div id="gate">
      <Rise className="box" targets="children">
        <h1>GOD'S EYE <span>by Autopilot</span></h1>
        <p>Live market signals and a desk that tells Autopilot where to place its next bet. Access is issued per person.</p>
        <input type="password" placeholder="Access key" autoComplete="current-password" aria-label="Access key"
          value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
        <button className="btn" onClick={handleSubmit} disabled={checking}>{checking ? "Checking" : "Open"}</button>
        <div id="g-err" role="alert">{error}</div>
      </Rise>
    </div>
  );
}
