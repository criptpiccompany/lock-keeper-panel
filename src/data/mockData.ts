import { User, Influencer, CloseEvent } from "@/types";

// Mock Users (5 closers + 1 admin)
export const mockUsers: User[] = [
  { id: "user-1", nome: "Carlos Silva", role: "CLOSER" },
  { id: "user-2", nome: "Ana Martins", role: "CLOSER" },
  { id: "user-3", nome: "Pedro Costa", role: "CLOSER" },
  { id: "user-4", nome: "Julia Santos", role: "CLOSER" },
  { id: "user-5", nome: "Rafael Lima", role: "CLOSER" },
  { id: "user-admin", nome: "Marina Admin", role: "ADMIN" },
];

// Current simulated user (change this to test different roles)
export const currentUser: User = mockUsers[0]; // Carlos Silva - CLOSER

// Helper to generate dates
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

// Mock Influencers (30 influencers with mixed states)
export const mockInfluencers: Influencer[] = [
  // Travados (locked) - recent closings
  { id: "inf-1", handle: "@fashionista_br", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(2), ativo: true },
  { id: "inf-2", handle: "@tech_guru", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(5), ativo: true },
  { id: "inf-3", handle: "@fitness_queen", ownerId: "user-2", ownerNome: "Ana Martins", lastClosedAt: daysAgo(1), ativo: true },
  { id: "inf-4", handle: "@travel_adventures", ownerId: "user-2", ownerNome: "Ana Martins", lastClosedAt: daysAgo(8), ativo: true, notas: "Viaja muito, difícil contato" },
  { id: "inf-5", handle: "@beauty_secrets", ownerId: "user-3", ownerNome: "Pedro Costa", lastClosedAt: daysAgo(3), ativo: true },
  { id: "inf-6", handle: "@gamer_pro", ownerId: "user-3", ownerNome: "Pedro Costa", lastClosedAt: daysAgo(7), ativo: true },
  { id: "inf-7", handle: "@foodie_life", ownerId: "user-4", ownerNome: "Julia Santos", lastClosedAt: daysAgo(4), ativo: true },
  { id: "inf-8", handle: "@music_vibes", ownerId: "user-4", ownerNome: "Julia Santos", lastClosedAt: daysAgo(6), ativo: true },
  { id: "inf-9", handle: "@lifestyle_daily", ownerId: "user-5", ownerNome: "Rafael Lima", lastClosedAt: daysAgo(9), ativo: true, notas: "Prestes a liberar!" },
  { id: "inf-10", handle: "@pet_lovers", ownerId: "user-5", ownerNome: "Rafael Lima", lastClosedAt: daysAgo(2), ativo: true },
  
  // Liberados (released) - old or no closing
  { id: "inf-11", handle: "@dance_moves", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: true },
  { id: "inf-12", handle: "@art_gallery", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(15), ativo: true },
  { id: "inf-13", handle: "@sports_fan", ownerId: "user-2", ownerNome: "Ana Martins", lastClosedAt: daysAgo(12), ativo: true },
  { id: "inf-14", handle: "@book_worm", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: true },
  { id: "inf-15", handle: "@movie_critic", ownerId: "user-3", ownerNome: "Pedro Costa", lastClosedAt: daysAgo(20), ativo: true },
  { id: "inf-16", handle: "@diy_crafts", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: true },
  { id: "inf-17", handle: "@nature_explorer", ownerId: "user-4", ownerNome: "Julia Santos", lastClosedAt: daysAgo(11), ativo: true },
  { id: "inf-18", handle: "@comedy_king", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: true },
  { id: "inf-19", handle: "@yoga_peace", ownerId: "user-5", ownerNome: "Rafael Lima", lastClosedAt: daysAgo(14), ativo: true },
  { id: "inf-20", handle: "@news_flash", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: true },
  
  // More mixed states
  { id: "inf-21", handle: "@makeup_artist", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(1), ativo: true },
  { id: "inf-22", handle: "@car_enthusiast", ownerId: "user-2", ownerNome: "Ana Martins", lastClosedAt: daysAgo(9), ativo: true },
  { id: "inf-23", handle: "@home_decor", ownerId: null, ownerNome: null, lastClosedAt: daysAgo(25), ativo: true },
  { id: "inf-24", handle: "@podcast_host", ownerId: "user-3", ownerNome: "Pedro Costa", lastClosedAt: daysAgo(6), ativo: true },
  { id: "inf-25", handle: "@crypto_trader", ownerId: "user-4", ownerNome: "Julia Santos", lastClosedAt: daysAgo(3), ativo: true },
  
  // Arquivados (archived)
  { id: "inf-26", handle: "@old_account", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(30), ativo: false, notas: "Conta desativada pelo influencer" },
  { id: "inf-27", handle: "@inactive_user", ownerId: "user-2", ownerNome: "Ana Martins", lastClosedAt: daysAgo(45), ativo: false, notas: "Sem resposta há meses" },
  { id: "inf-28", handle: "@banned_profile", ownerId: null, ownerNome: null, lastClosedAt: null, ativo: false, notas: "Violou termos da plataforma" },
  
  // More active
  { id: "inf-29", handle: "@skincare_tips", ownerId: "user-5", ownerNome: "Rafael Lima", lastClosedAt: daysAgo(4), ativo: true },
  { id: "inf-30", handle: "@motivation_daily", ownerId: "user-1", ownerNome: "Carlos Silva", lastClosedAt: daysAgo(8), ativo: true, notas: "Alto engajamento" },
];

// Mock Close Events (audit trail)
export const mockCloseEvents: CloseEvent[] = [
  { id: "evt-1", influencerId: "inf-1", influencerHandle: "@fashionista_br", feitoPorId: "user-1", feitoPorNome: "Carlos Silva", feitoEm: daysAgo(2), acao: "FECHAMENTO" },
  { id: "evt-2", influencerId: "inf-2", influencerHandle: "@tech_guru", feitoPorId: "user-1", feitoPorNome: "Carlos Silva", feitoEm: daysAgo(5), acao: "FECHAMENTO" },
  { id: "evt-3", influencerId: "inf-3", influencerHandle: "@fitness_queen", feitoPorId: "user-2", feitoPorNome: "Ana Martins", feitoEm: daysAgo(1), acao: "FECHAMENTO" },
  { id: "evt-4", influencerId: "inf-4", influencerHandle: "@travel_adventures", feitoPorId: "user-2", feitoPorNome: "Ana Martins", feitoEm: daysAgo(8), acao: "FECHAMENTO" },
  { id: "evt-5", influencerId: "inf-26", influencerHandle: "@old_account", feitoPorId: "user-admin", feitoPorNome: "Marina Admin", feitoEm: daysAgo(10), acao: "ARQUIVAR", motivo: "Conta desativada pelo influencer" },
  { id: "evt-6", influencerId: "inf-27", influencerHandle: "@inactive_user", feitoPorId: "user-admin", feitoPorNome: "Marina Admin", feitoEm: daysAgo(15), acao: "ARQUIVAR", motivo: "Sem resposta há meses" },
  { id: "evt-7", influencerId: "inf-5", influencerHandle: "@beauty_secrets", feitoPorId: "user-3", feitoPorNome: "Pedro Costa", feitoEm: daysAgo(3), acao: "FECHAMENTO" },
  { id: "evt-8", influencerId: "inf-12", influencerHandle: "@art_gallery", feitoPorId: "user-admin", feitoPorNome: "Marina Admin", feitoEm: daysAgo(16), acao: "OVERRIDE_ADMIN", motivo: "Transferência solicitada pelo closer anterior" },
];
