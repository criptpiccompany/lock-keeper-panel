// User Types
export type UserRole = "CLOSER" | "ADMIN" | "SUBADMIN";

export interface User {
  id: string;
  nome: string;
  role: UserRole;
}

// Influencer Types
export type InfluencerStatus = "TRAVADO" | "LIBERADO" | "ARQUIVADO";

export interface Influencer {
  id: string;
  handle: string;
  ownerId: string | null;
  ownerNome: string | null;
  lastClosedAt: string | null;
  ativo: boolean;
  notas?: string;
}

// Close Event Types (Immutable Audit Log)
export type CloseEventAction = "FECHAMENTO" | "OVERRIDE_ADMIN" | "ARQUIVAR";

export interface CloseEvent {
  id: string;
  influencerId: string;
  influencerHandle: string;
  feitoPorId: string;
  feitoPorNome: string;
  feitoEm: string;
  acao: CloseEventAction;
  motivo?: string;
}

// Computed Types
export interface InfluencerWithStatus extends Influencer {
  status: InfluencerStatus;
  lockedUntil: Date | null;
  timeRemaining: number | null; // in milliseconds
  daysRemaining: number | null;
}
