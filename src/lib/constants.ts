// Business Rules
export const LOCK_DURATION_DAYS = 10;
export const LOCK_DURATION_MS = LOCK_DURATION_DAYS * 24 * 60 * 60 * 1000;

// Status Colors (for reference, actual styles in CSS)
export const STATUS_COLORS = {
  TRAVADO: "amber",
  LIBERADO: "green", 
  ARQUIVADO: "gray",
} as const;
