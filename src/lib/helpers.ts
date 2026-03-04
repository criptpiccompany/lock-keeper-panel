import { Influencer, InfluencerStatus, InfluencerWithStatus, User } from "@/types";
import { LOCK_DURATION_MS } from "./constants";

// Lock info from influencer_locks table
export interface LockInfo {
  locked_until: string;
}

// Calculate influencer status based on actual lock data
// TRAVADO only if a valid lock exists in influencer_locks with locked_until > now()
export function calculateInfluencerStatus(influencer: Influencer, lock?: LockInfo | null): InfluencerStatus {
  if (!influencer.ativo) return "ARQUIVADO";
  if (!lock) return "LIBERADO";
  
  const lockedUntil = new Date(lock.locked_until);
  const now = new Date();
  
  return now < lockedUntil ? "TRAVADO" : "LIBERADO";
}

// Calculate locked until date from lock data
export function calculateLockedUntil(lock?: LockInfo | null): Date | null {
  if (!lock) return null;
  const d = new Date(lock.locked_until);
  return d.getTime() > Date.now() ? d : null;
}

// Calculate time remaining in milliseconds
export function calculateTimeRemaining(lockedUntil: Date | null): number | null {
  if (!lockedUntil) return null;
  const remaining = lockedUntil.getTime() - new Date().getTime();
  return remaining > 0 ? remaining : 0;
}

// Convert milliseconds to days
export function msToDays(ms: number | null): number | null {
  if (ms === null) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// Enrich influencer with computed fields using actual lock data
export function enrichInfluencer(influencer: Influencer, lock?: LockInfo | null): InfluencerWithStatus {
  const status = calculateInfluencerStatus(influencer, lock);
  const lockedUntil = calculateLockedUntil(lock);
  const timeRemaining = status === "TRAVADO" ? calculateTimeRemaining(lockedUntil) : null;
  const daysRemaining = msToDays(timeRemaining);
  
  return {
    ...influencer,
    status,
    lockedUntil,
    timeRemaining,
    daysRemaining,
  };
}

// Check if user can register fechamento
export function canRegisterFechamento(influencer: InfluencerWithStatus, user: User): boolean {
  if (influencer.status === "ARQUIVADO") return false;
  if (influencer.status === "LIBERADO") return true;
  // TRAVADO: only owner can register
  return influencer.ownerId === user.id;
}

// Format date for display
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Format datetime for display
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format countdown display
export function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return "00:00:00:00";
  
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Generate UUID — with fallback for Safari < 15.4 and insecure contexts
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback
    }
  }
  // Fallback: manual UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
