import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "online" | "offline" | "server-down";

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("online");

  useEffect(() => {
    const handleOnline = () => {
      setStatus("online");
      checkServer();
    };
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) setStatus("offline");

    const checkServer = async () => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
        const res = await fetch(url, {
          method: "GET",
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // Any HTTP response (even 401) means the server is reachable
        setStatus(res ? "online" : "server-down");
      } catch {
        setStatus(navigator.onLine ? "server-down" : "offline");
      }
    };

    // Initial check + periodic poll
    checkServer();
    const interval = setInterval(checkServer, 30000);

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
