import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "online" | "offline" | "server-down";

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    // Debounce: only flip to "server-down" after 2 consecutive failed checks
    // to avoid flashing the banner on transient network blips.
    let consecutiveFailures = 0;

    const checkServer = async () => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
        const res = await fetch(url, {
          method: "GET",
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res) {
          consecutiveFailures = 0;
          setStatus((prev) => (prev === "online" ? prev : "online"));
        } else {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 2) setStatus("server-down");
        }
      } catch {
        if (!navigator.onLine) {
          setStatus("offline");
          return;
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setStatus("server-down");
      }
    };

    const handleOnline = () => {
      consecutiveFailures = 0;
      setStatus("online");
      checkServer();
    };
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) setStatus("offline");

    // Initial check + slower poll (120s) — avoids visible flicker every 30s.
    checkServer();
    const interval = setInterval(checkServer, 120000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (status === "online") return null;

  const isOffline = status === "offline";
  const config = isOffline
    ? {
        icon: WifiOff,
        title: "Sem conexão com a internet",
        description: "Verifique seu Wi-Fi ou dados móveis.",
        bg: "bg-destructive",
        fg: "text-destructive-foreground",
      }
    : {
        icon: AlertTriangle,
        title: "Falha ao conectar ao servidor",
        description: "Tente aba anônima, desativar VPN/AdBlock ou usar 4G.",
        bg: "bg-amber-500",
        fg: "text-white",
      };

  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[100] ${config.bg} ${config.fg} shadow-md`}
    >
      <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold">{config.title}</span>
          <span className="hidden sm:inline opacity-90"> — {config.description}</span>
        </div>
      </div>
    </div>
  );
}
