"use client";

import { useEffect, useState } from "react";

export function ToastHost() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const show = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setMessage(custom.detail);
      window.setTimeout(() => setMessage(""), 2400);
    };
    window.addEventListener("maiabeat:toast", show);
    return () => window.removeEventListener("maiabeat:toast", show);
  }, []);

  if (!message) return null;

  return (
    <div className="toast-host rounded-2xl border-[3px] border-black bg-[#29FF87] px-4 py-3 text-center text-sm font-black shadow-[5px_5px_0_#000]">
      {message}
    </div>
  );
}
