// Business Rules
export const LOCK_DURATION_DAYS = 10;
export const LOCK_DURATION_MS = LOCK_DURATION_DAYS * 24 * 60 * 60 * 1000;

// Platform fee rate (applied on revenue)
export const PLATFORM_FEE_RATE = 0.06;
export const PLATFORM_FEE_LABEL = "Taxa 6%";

// Daily spreadsheet uses 10% for internal calculation
export const DAILY_FEE_RATE = 0.10;
export const DAILY_FEE_LABEL = "Taxa 10% (Para Cálculo)";

// Admin Dashboard operational taxes
export const ADMIN_TAX_DEV_RATE = 0.02;
export const ADMIN_TAX_GATEWAY_RATE = 0.03;
export const ADMIN_TAX_TOTAL_RATE = ADMIN_TAX_DEV_RATE + ADMIN_TAX_GATEWAY_RATE; // 5%

// Status Colors (for reference, actual styles in CSS)
export const STATUS_COLORS = {
  TRAVADO: "amber",
  LIBERADO: "green", 
  ARQUIVADO: "gray",
} as const;
