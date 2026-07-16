# Mapa do sistema — CriptPic Board

> Documento operacional para orientar qualquer alteração. O onboarding define o
> produto desejado; este mapa registra o que existe no repositório neste momento.
> Quando os dois divergirem, a decisão deve ser confirmada antes de mudar código.

## 1. Visão geral

```text
Usuário no navegador
└── React 18 + Vite
    ├── AuthProvider: sessão, perfil, papel e equipe
    ├── React Router: rotas públicas e protegidas
    ├── WorkspaceLayout: navegação por papel
    ├── Páginas e componentes de domínio
    └── Cliente Supabase
        ├── PostgREST → tabelas, RPCs e RLS
        ├── Auth → login, convite e recuperação
        ├── Storage → bucket comprovantes
        ├── Realtime → atualizações de Comprovantes
        └── Edge Functions Deno
            ├── administração e auditoria
            ├── OCR de Comprovantes
            └── scrapers Influboard e MegaArena
```

Fontes de verdade por camada:

| Assunto | Fonte |
|---|---|
| Rotas | `src/App.tsx` |
| Sessão e papel efetivo | `src/hooks/useAuth.tsx` |
| Navegação e layout | `src/components/WorkspaceLayout.tsx` |
| Tipos atuais do banco | `src/integrations/supabase/types.ts` (gerado) |
| Evolução do banco | `supabase/migrations/` |
| Cálculo de comissão | `src/lib/commissionCalc.ts` |
| Termômetros | `src/lib/thermometerSnapshot.ts` |
| Constantes financeiras e lock | `src/lib/constants.ts` |
| Novo Planilhamento do closer | `src/components/planilhamento/PlanilhaBeta.tsx` |
| Planilhamento operacional anterior | `src/components/planilhamento/PlanilhamentoDiario.tsx` |
| Infra local | `Dockerfile` + `compose.yaml` |
| Infra Hostinger preparada | `Dockerfile.production` + `compose.production.yaml` |

## 2. Árvore funcional

```text
CriptPic Board
├── Acesso e pessoas
│   ├── Login
│   ├── Convites single-use
│   ├── Aprovação de contas
│   ├── Perfis e papéis
│   ├── Equipes
│   └── Administração de usuários
├── Operação do closer
│   ├── Home
│   ├── Minha Lista
│   ├── Planilhamento
│   │   ├── Planilhamento Diário novo
│   │   ├── Balanço
│   │   └── Lista do Mês
│   ├── Meu Painel / locks
│   ├── Gestão de Influs / Kanban (código existente, sem rota ativa)
│   └── Influs Travados / Influboard
├── Operação administrativa
│   ├── Dashboard
│   ├── Financeiro consolidado
│   ├── Diretório
│   ├── Notificações
│   ├── Auditoria
│   ├── Aprovações, convites e órfãos
│   ├── Ranking Semanal
│   └── Radar de conflitos
├── Operação financeira
│   ├── Comprovantes por closer e dia
│   └── Espelhamento de Planilhamento
├── Regras automáticas
│   ├── Lock de influenciador
│   ├── Cálculo de resultado e comissão
│   ├── Auditoria de alterações
│   ├── OCR de Comprovantes
│   └── Soft-delete
└── Integrações externas
    ├── Influboard
    ├── MegaArena
    └── Gateway de IA da Lovable (OCR; precisa ser substituído na migração)
```

## 3. Papéis e acesso

### Modelo de banco

Papéis ativos: `CLOSER | ADMIN | FINANCEIRO`. O papel fica em `user_roles`;
`profiles` contém identidade operacional, status e `team_id`.

### Implementação atual do frontend

`useAuth.tsx` tipa `CLOSER | ADMIN | FINANCEIRO`. O antigo papel SUBADMIN foi
descontinuado pela migration `20260715170000_retire_subadmin_role.sql`; contas
antigas são convertidas para CLOSER e o uso do valor é bloqueado.

| Papel | Acesso implementado |
|---|---|
| CLOSER | `/home`, `/meu`, `/registro`, `/painel`, `/influboard-test` |
| ADMIN | rotas do closer + administração + financeiro |
| FINANCEIRO | somente `/financeiro/comprovantes` e `/financeiro/espelhamento` |

`ProtectedRoute.tsx` controla aprovação e redirecionamento. ADMIN e FINANCEIRO
são tratados como elevados. A regra implementada hoje mantém ADMIN em visão
unificada; isso diverge da regra documentada de iniciar como CLOSER.

## 4. Rotas e proprietários

```text
Públicas
├── /login → Login.tsx
└── /aguardando-aprovacao → PendingApproval.tsx

Protegidas pelo WorkspaceLayout
├── /home → Home.tsx
├── /meu → MeuPainel.tsx
├── /painel → PainelGeral.tsx
├── /registro → RegistroDiario.tsx → PlanilhamentoTabs.tsx
├── /influboard-test → InfluboardTest.tsx
├── /dashboard → Dashboard.tsx [ADMIN]
├── /financeiro → Financeiro.tsx [ADMIN]
├── /diretorio → Diretorio.tsx [ADMIN]
├── /notificacoes → Notificacoes.tsx [ADMIN]
├── /auditoria → Auditoria.tsx [ADMIN]
├── /admin → Admin.tsx [ADMIN]
├── /import → ImportData.tsx [ADMIN]
├── /financeiro/comprovantes → FinanceiroWorkspace [FINANCEIRO/ADMIN]
└── /financeiro/espelhamento → FinanceiroWorkspace [FINANCEIRO/ADMIN]

Fora do layout
└── * → NotFound.tsx
```

Código sem rota ativa: `GestaoInfluenciadores.tsx` monta `KanbanBoard`, mas não
está registrado em `App.tsx`.

## 5. Frontend por domínio

### Minha Lista

```text
MeuPainel.tsx
├── lê influencers do owner_id atual
├── lê influencer_locks ativos
├── AddInfluencerUnifiedModal
└── exibe status, dias restantes e notas
```

Adicionar pela nova planilha também insere em `influencers`. A lista é a carteira
do closer; inserir nela, sozinho, não cria fechamento nem lock.

### Planilhamento

```text
RegistroDiario.tsx
└── PlanilhamentoTabs.tsx
    ├── CLOSER
    │   ├── Diário → PlanilhaBeta.tsx
    │   ├── Balanço → Balanco.tsx
    │   └── Lista do Mês → ListaDoMes.tsx
    └── ADMIN
        ├── Ranking Semanal
        ├── Conflitos
        ├── Planilha Beta
        └── planilhamentos por closer
```

Existem duas interfaces de Planilhamento sobre o mesmo registro operacional:

- `PlanilhaBeta.tsx`: experiência visual semelhante ao Google Sheets; usa
  `planilha_beta` para posição/estrutura visual da grade e grava os valores
  operacionais, Observação e vínculo do Comprovante em
  `daily_influencer_records` + `daily_receipt_uploads`.
- `PlanilhamentoDiario.tsx`: fluxo operacional anterior; usa `daily_sheets`,
  `daily_influencer_records`, locks, compartilhamentos, edição justificada e
  Comprovantes legados.

As duas experiências visuais permanecem, mas `daily_influencer_records` é a
fonte oficial dos dados financeiros. A tabela `planilha_beta` não deve receber
novas colunas financeiras ou de Comprovantes; ela serve somente para reconstruir
a posição das linhas na interface semelhante à planilha.

### Comprovantes

```text
Closer / PlanilhaBeta
└── upload no bucket comprovantes
    └── daily_receipt_uploads.daily_record_id

Financeiro / QuickAddReceiptBar
└── seleciona closer + data + influenciador
    └── daily_receipt_uploads.daily_record_id

DailyReceiptsCarousel
├── lê daily_receipt_uploads
├── suporta Realtime
├── abre ComprovanteLightbox
└── mantém compatibilidade com URLs legadas
```

Closer e Financeiro utilizam o mesmo `daily_record_id`; não há coluna paralela
de Comprovante em `planilha_beta`.

### Financeiro e termômetros

```text
daily_influencer_records
├── Faturamento
├── Investido / valor pago
└── taxa operacional da equipe
    └── Resultado
        └── tier de comissão
            └── comissão estimada
```

Fonte central do snapshot: `thermometerSnapshot.ts`. Fonte da comissão estimada:
`commissionCalc.ts`. O fallback de taxa operacional é 6%.

O novo Planilhamento calcula por linha:

- Resultado = Faturamento - Pagamento - 3% do Faturamento.
- ROI = Faturamento / Pagamento.

Essa regra de 3% é específica da tela nova e diverge de `DAILY_FEE_RATE = 10%`
em `constants.ts`; precisa ser formalizada antes da consolidação financeira.

### Kanban

`components/kanban/` usa `kanban_influencers` e contém board, colunas, cards,
edição, inclusão e arquivados. A classificação e colunas ficam em `types.ts`.
O módulo está implementado, mas sem rota ativa.

### Estado

- React Query está instalado e envolve o app.
- Muitas páginas ainda carregam listas por `useEffect` + Supabase diretamente.
- `useStore.ts` contém dados mockados e ações antigas em memória; é utilizado por
  componentes legados de fechamento, não é fonte do backend real.
- `useLayoutStore.ts` controla apenas o layout full-width da planilha.

## 6. Mapa de dados

```text
auth.users
├── profiles ── team_id ── teams
└── user_roles

profiles/closer
├── influencers
│   ├── close_events
│   └── influencer_locks
├── kanban_influencers
├── daily_sheets
│   └── daily_influencer_records
│       ├── daily_record_shared_partners
│       └── daily_receipt_uploads.daily_record_id
├── planilha_beta
│   └── espelha a posição visual; dados operacionais ficam no registro diário
├── monthly_influencer_list
├── monthly_platform_names
└── team_shared_board

Administração
├── invites
├── commission_tiers
├── admin_conflicts
├── admin_notifications
├── audit_log [legado]
└── audit_logs [principal]

Influboard
├── influboard_locked_cache
├── influboard_lock_history
└── influboard_sync_meta

MegaArena
├── megaarena_afiliados
├── megaarena_snapshots
├── megaarena_janela_9h
└── megaarena_sync_meta
```

### Responsabilidade das tabelas

| Grupo | Tabelas |
|---|---|
| Identidade | `profiles`, `user_roles`, `teams`, `invites` |
| Influenciadores | `influencers`, `close_events`, `influencer_locks` |
| Planilhamento principal | `daily_sheets`, `daily_influencer_records`, `daily_record_shared_partners` |
| Planilhamento novo | `planilha_beta` |
| Comprovantes | `daily_receipt_uploads` |
| Fechamento mensal | `monthly_influencer_list`, `monthly_platform_names` |
| Gestão de Influs | `kanban_influencers` |
| Compartilhamento | `team_shared_board` |
| Comissão | `commission_tiers`, `teams.taxa_operacional` |
| Controle | `admin_conflicts`, `admin_notifications`, `audit_logs` |
| Espelhos externos | tabelas `influboard_*` e `megaarena_*` |

### Funções SQL relevantes

- Segurança: `has_role`, `is_approved`, `is_global_viewer`, `is_same_team`,
  `is_team_admin`, `get_user_team_id`.
- Convites: `validate_invite_token`, `consume_invite_token`.
- Consulta: `get_approved_closers`, `get_public_influencers`,
  `get_shared_board_users`, `get_global_daily_revenue`.
- Administração: `admin_move_user_team`.
- Sincronização: `sync_influencer_to_closer`.
- Automação: `auto_set_team_id`, `fn_audit_trigger`, `handle_new_user`.

## 7. Edge Functions

| Função | Responsabilidade | Segredos/dependências |
|---|---|---|
| `admin-update-user` | senha, status e ações administrativas | service role |
| `create-user` | cria usuário via Admin Auth | service role |
| `manage-orphan-users` | lista/remove usuários sem estrutura completa | service role |
| `send-password-reset` | recuperação iniciada por admin | service role |
| `import-data` | importação administrativa destrutiva/substitutiva | service role |
| `store-edit-reason` | registra justificativa e gera notificação | anon + service role |
| `scan-conflicts` | cruza listas mensais e grava conflitos | anon + service role |
| `parse-receipt` | OCR/IA e atualização do Comprovante | service role + `LOVABLE_API_KEY` |
| `influboard-scrape` | login, scrape, cache, histórico e meta | credenciais Influboard |
| `megaarena-scrape` | login, afiliados e snapshots | credenciais MegaArena |
| `megaarena-close-window` | consolida janela 09h→09h | service role |

Na Hostinger, essas funções podem permanecer em Deno ou ser empacotadas como
workers. Os scrapers devem rodar isolados, com retry, lock contra execução dupla,
logs estruturados e segredos fora do repositório.

## 8. Fluxos críticos

### Login e aprovação

```text
Login → Supabase Auth → profiles + user_roles
├── não aprovado → aguardando-aprovacao
├── FINANCEIRO → financeiro/comprovantes
└── demais → home
```

### Cadastro de influenciador

```text
Minha Lista ou Planilha nova
→ normaliza @handle
→ verifica duplicidade
→ INSERT influencers com owner_id + team_id automático
→ aparece na Minha Lista
```

### Fechamento e lock

```text
Registro em daily_influencer_records
→ upsert influencer_locks
→ locked_until = registro + 10 dias
→ Minha Lista / Meu Painel / Diretório exibem TRAVADO
```

O fluxo `planilha_beta` ainda não cria `daily_influencer_records`; portanto hoje
ele não participa automaticamente do mesmo lock e das agregações financeiras.

### Comprovante compartilhado

```text
Closer ou Financeiro
→ Storage/comprovantes
→ daily_receipt_uploads
→ vínculo com linha
→ Realtime atualiza a outra tela
→ parse-receipt extrai dados quando aplicável
```

### Auditoria de edição

```text
Edição sensível fora do mesmo dia
→ EditReasonModal
→ store-edit-reason
→ audit_logs + admin_notifications
→ fn_audit_trigger registra a alteração de dados
```

### Scrapers

```text
Influboard
→ login externo → scrape → cache atual
                    ├── histórico de locks
                    └── metadados da sincronização

MegaArena a cada 3 min
→ login externo → afiliados → snapshots
→ fechamento 09h05 BRT → megaarena_janela_9h
```

## 9. Infraestrutura

### Desenvolvimento atual

`compose.yaml` monta o repositório no container e executa Vite em `:8080`.

### Produção preparada

`Dockerfile.production` compila o bundle e o serve com Nginx sem privilégios.
`compose.production.yaml` adiciona healthcheck, filesystem read-only e reinício.

### Produção-alvo Hostinger

```text
Internet
└── proxy HTTPS
    ├── www.criptpicboard.com → frontend Nginx
    └── backend.criptpicboard.com → Supabase APIs
        ├── Postgres
        ├── Auth
        ├── PostgREST
        ├── Storage
        ├── Realtime
        └── Functions/workers
```

Banco, Studio e portas internas não devem ficar públicos. Backups de banco e
Storage devem sair da mesma VPS.

## 10. Divergências e riscos conhecidos

### Bloqueadores atuais

1. O Diário novo precisa ser validado com uma sessão real de closer depois da
   consolidação feita entre `planilha_beta` e `daily_influencer_records`.
2. A base de produção da Hostinger ainda precisa ser criada e receber todas as
   migrations em ordem.

### Divergências com o onboarding

1. ADMIN está em visão unificada no código, não inicia como CLOSER.
2. O Diário novo usa taxa de 3%; a constante documentada do Diário é 10%.
3. Há muitas cores hardcoded em componentes, apesar da regra de tokens.
4. Diversas listas usam `useEffect` em vez de React Query.
5. `useStore.ts` e componentes associados mantêm um domínio mockado/legado.
6. Gestão de Influs existe, mas não possui rota ativa.

### Qualidade técnica medida

- Build de produção: passa.
- Testes existentes: 1 arquivo / 1 teste, passa; cobertura insuficiente para os
  fluxos críticos.
- ESLint: baseline atual de 297 ocorrências (269 erros e 28 avisos), concentradas
  principalmente em `any`, dependências de hooks e código legado. A correção
  deve ser feita por domínio, sem aplicar `--fix` global.

### Arquivos com responsabilidade excessiva

| Arquivo | Tamanho aproximado | Risco |
|---|---:|---|
| `PlanilhamentoDiario.tsx` | 2.338 linhas | dados, UI, cálculo, upload, lock e auditoria juntos |
| `CloserSharedBoard.tsx` | 1.664 linhas | quadro compartilhado inteiro num componente |
| `Home.tsx` | 986 linhas | home de closer e admin no mesmo arquivo |
| `Admin.tsx` | 862 linhas | usuários, influenciadores, equipes e ações |
| `ListaDoMes.tsx` | 777 linhas | leitura, edição, cálculo e apresentação |
| `PlanilhaBeta.tsx` | 700+ linhas | grid, persistência, autocomplete e Comprovantes |

Não devem ser reescritos de uma vez. A simplificação deve extrair primeiro hooks
de dados e regras puras, cobertos por testes, mantendo a UI aprovada.

## 11. Regra de trabalho daqui em diante

Antes de qualquer mudança:

1. Identificar neste mapa o fluxo, rota, tabela e papel afetados.
2. Confirmar qual fonte de dados é oficial naquele fluxo.
3. Listar migrations e RLS impactadas.
4. Implementar o menor diff possível.
5. Validar build, teste do papel afetado e persistência após reload.
6. Atualizar este mapa se a arquitetura ou a propriedade de dados mudar.
7. Só publicar depois de aplicar migrations e validar frontend contra o mesmo
   backend que irá para produção.

Nenhuma solução nova deve criar uma terceira fonte de verdade, duplicar cálculo
financeiro ou contornar RLS no frontend.
