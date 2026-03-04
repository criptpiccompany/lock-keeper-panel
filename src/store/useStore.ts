import { create } from "zustand";
import { User, Influencer, CloseEvent, InfluencerWithStatus, CloseEventAction } from "@/types";
import { mockUsers, mockInfluencers, mockCloseEvents, currentUser } from "@/data/mockData";
import { enrichInfluencer, generateId } from "@/lib/helpers";

interface AppState {
  // Data
  users: User[];
  influencers: Influencer[];
  closeEvents: CloseEvent[];
  currentUser: User;
  
  // Computed
  getEnrichedInfluencers: () => InfluencerWithStatus[];
  getInfluencerById: (id: string) => InfluencerWithStatus | undefined;
  getEventsByInfluencer: (influencerId: string) => CloseEvent[];
  getMyInfluencers: () => InfluencerWithStatus[];
  
  // Actions
  registerFechamento: (influencerId: string) => void;
  addInfluencer: (handle: string, notas?: string) => void;
  archiveInfluencer: (influencerId: string, motivo: string, arquivar: boolean) => void;
  adminOverride: (influencerId: string, newOwnerId: string | null, newLastClosedAt: string | null, motivo: string) => void;
  setCurrentUser: (user: User) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial data from mocks
  users: mockUsers,
  influencers: mockInfluencers,
  closeEvents: mockCloseEvents,
  currentUser: currentUser,
  
  // Computed getters (no lock data in store — all return LIBERADO by default)
  getEnrichedInfluencers: () => {
    return get().influencers.map(i => enrichInfluencer(i));
  },
  
  getInfluencerById: (id: string) => {
    const influencer = get().influencers.find((i) => i.id === id);
    return influencer ? enrichInfluencer(influencer) : undefined;
  },
  
  getEventsByInfluencer: (influencerId: string) => {
    return get().closeEvents
      .filter((e) => e.influencerId === influencerId)
      .sort((a, b) => new Date(b.feitoEm).getTime() - new Date(a.feitoEm).getTime());
  },
  
  getMyInfluencers: () => {
    const user = get().currentUser;
    return get().influencers
      .filter((i) => i.ownerId === user.id && i.ativo)
      .map(i => enrichInfluencer(i));
  },
  
  // Actions
  registerFechamento: (influencerId: string) => {
    const user = get().currentUser;
    const influencer = get().influencers.find((i) => i.id === influencerId);
    if (!influencer) return;
    
    const now = new Date().toISOString();
    
    // Create close event
    const newEvent: CloseEvent = {
      id: generateId(),
      influencerId,
      influencerHandle: influencer.handle,
      feitoPorId: user.id,
      feitoPorNome: user.nome,
      feitoEm: now,
      acao: "FECHAMENTO",
    };
    
    set((state) => ({
      closeEvents: [newEvent, ...state.closeEvents],
      influencers: state.influencers.map((i) =>
        i.id === influencerId
          ? { ...i, lastClosedAt: now, ownerId: user.id, ownerNome: user.nome }
          : i
      ),
    }));
  },
  
  addInfluencer: (handle: string, notas?: string) => {
    const user = get().currentUser;
    
    const newInfluencer: Influencer = {
      id: generateId(),
      handle,
      ownerId: user.id,
      ownerNome: user.nome,
      lastClosedAt: null,
      ativo: true,
      notas,
    };
    
    set((state) => ({
      influencers: [...state.influencers, newInfluencer],
    }));
  },
  
  archiveInfluencer: (influencerId: string, motivo: string, arquivar: boolean) => {
    const user = get().currentUser;
    const influencer = get().influencers.find((i) => i.id === influencerId);
    if (!influencer) return;
    
    const newEvent: CloseEvent = {
      id: generateId(),
      influencerId,
      influencerHandle: influencer.handle,
      feitoPorId: user.id,
      feitoPorNome: user.nome,
      feitoEm: new Date().toISOString(),
      acao: "ARQUIVAR",
      motivo: `${arquivar ? "Arquivado" : "Desarquivado"}: ${motivo}`,
    };
    
    set((state) => ({
      closeEvents: [newEvent, ...state.closeEvents],
      influencers: state.influencers.map((i) =>
        i.id === influencerId ? { ...i, ativo: !arquivar } : i
      ),
    }));
  },
  
  adminOverride: (influencerId: string, newOwnerId: string | null, newLastClosedAt: string | null, motivo: string) => {
    const user = get().currentUser;
    const influencer = get().influencers.find((i) => i.id === influencerId);
    if (!influencer) return;
    
    const newOwner = newOwnerId ? get().users.find((u) => u.id === newOwnerId) : null;
    
    const newEvent: CloseEvent = {
      id: generateId(),
      influencerId,
      influencerHandle: influencer.handle,
      feitoPorId: user.id,
      feitoPorNome: user.nome,
      feitoEm: new Date().toISOString(),
      acao: "OVERRIDE_ADMIN",
      motivo,
    };
    
    set((state) => ({
      closeEvents: [newEvent, ...state.closeEvents],
      influencers: state.influencers.map((i) =>
        i.id === influencerId
          ? {
              ...i,
              ownerId: newOwnerId !== undefined ? newOwnerId : i.ownerId,
              ownerNome: newOwner ? newOwner.nome : (newOwnerId === null ? null : i.ownerNome),
              lastClosedAt: newLastClosedAt !== undefined ? newLastClosedAt : i.lastClosedAt,
            }
          : i
      ),
    }));
  },
  
  setCurrentUser: (user: User) => {
    set({ currentUser: user });
  },
}));
