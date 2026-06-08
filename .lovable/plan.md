## Objetivo
Criar o perfil **FINANCEIRO** (acesso global como ADMIN) com duas abas dedicadas, e refatorar o Planilhamento Diário para mostrar comprovantes em um carrossel horizontal no rodapé (estilo stories), removendo a coluna por linha.

---

## 1. Backend — Novo perfil e tabela de comprovantes do dia

### 1.1 Enum + RLS global
- Adicionar `'FINANCEIRO'` ao enum `app_role`.
- Atualizar `handle_new_user` para aceitar `FINANCEIRO` via convite.
- Atualizar **todas** as policies que hoje liberam ADMIN para também liberar FINANCEIRO em SELECT/UPDATE/INSERT (tabelas: `profiles`, `influencers`, `daily_influencer_records`, `daily_sheets`, `daily_record_shared_partners`, `monthly_influencer_list`, `monthly_platform_names`, `teams`, `commission_tiers`, `influencer_locks`, `kanban_influencers`, `team_shared_board`, `admin_conflicts`, `admin_notifications`, `audit_logs`).
- `get_public_influencers`, `get_approved_closers`, `get_global_daily_revenue` → liberar FINANCEIRO igual ADMIN.

### 1.2 Nova tabela `daily_receipt_uploads`
Comprovantes do dia por closer (avulsos, com opção de marcar influenciador).

```
id uuid pk
date date not null
closer_id uuid not null -> profiles
team_id uuid not null
daily_record_id uuid null -> daily_influencer_records  (opcional: marca influenciador)
file_url text not null
file_type text  -- 'image' | 'pdf'
uploaded_by uuid not null -> profiles
created_at, updated_at, deleted_at, deleted_by
```
- GRANT padrão; RLS:
  - SELECT: ADMIN, FINANCEIRO, SUBADMIN (mesmo time), CLOSER dono.
  - INSERT/UPDATE: ADMIN, FINANCEIRO, CLOSER dono.
  - Trigger `auto_set_team_id` (deriva de `closer_id`).
  - Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_receipt_uploads;`

### 1.3 Realtime no Planilhamento
- Garantir publication para `daily_influencer_records` e `daily_receipt_uploads` (Espelhamento ao vivo).

---

## 2. Frontend — Roles e roteamento

### 2.1 `useAuth`
- Adicionar `isFinanceiro` ao contexto.
- `isAdmin || isFinanceiro` em todos os pontos de checagem onde o FINANCEIRO precisa ver tudo.

### 2.2 `ProtectedRoute`
- Nova prop `requireFinanceiro` que aceita ADMIN ou FINANCEIRO.

### 2.3 Rotas (App.tsx)
- `/financeiro/comprovantes` (Aba 1) — somente FINANCEIRO + ADMIN.
- `/financeiro/espelhamento` (Aba 2) — somente FINANCEIRO + ADMIN.
- Default redirect do FINANCEIRO no login → `/financeiro/comprovantes`.

### 2.4 Navbar
- FINANCEIRO vê apenas: **Comprovantes**, **Espelhamento**, **Notificações** (sem Home/Meu/Painel/Admin).

---

## 3. Refator do Planilhamento Diário (carrossel de comprovantes)

### 3.1 `PlanilhamentoDiario.tsx`
- Remover a coluna **Comprovantes** da tabela (e do card mobile).
- Remover `ProofUploader`/modal por linha.
- Adicionar rodapé fixo abaixo da tabela: **Comprovantes do dia** — carrossel horizontal scrollável.
  - Cada item: thumbnail 80×80 estilo story (círculo/quadrado arredondado), badge PDF/IMG, clique → `ComprovanteLightbox`.
  - Botão "+" no início do carrossel: abre uploader (drag, paste, file, camera) e cria registro em `daily_receipt_uploads` (date = dia da aba, closer_id = closer atual).
  - Opção "Marcar influenciador" no upload (dropdown com as linhas do dia daquele closer, opcional).
  - Long-press/menu → remover (soft-delete, mesma regra de justificativa para dias passados).

### 3.2 Migração de dados (não destrutiva)
- Manter coluna `comprovante_url` no `daily_influencer_records` por compatibilidade; apenas esconder da UI. Comprovantes legados aparecem no carrossel sob "Comprovantes antigos" mapeando os `comprovante_url` existentes do dia.

### 3.3 Regra de "Pendente"
- Continua dependendo do 1º comprovante; passa a considerar `daily_receipt_uploads` do dia para aquele closer (qualquer um) **ou** `comprovante_url` legado.

---

## 4. Aba 1 — Comprovantes (FINANCEIRO)

Layout: seletor de data (default hoje) + grid horizontal com **uma coluna por closer aprovado**.
- Header da coluna: foto/nome do closer + total de comprovantes do dia.
- Corpo: drop-zone aceitando paste/drag/click; lista vertical de thumbs já enviados.
- Cada upload cria `daily_receipt_uploads {date, closer_id, file_url, uploaded_by: financeiro}`.
- Botão "Marcar influenciador" abre popover com linhas do planilhamento daquele closer no dia.
- Realtime: novos uploads (de qualquer origem) aparecem instantaneamente.

## 5. Aba 2 — Espelhamento (FINANCEIRO)

- Reaproveita `PlanilhamentoCalendarWorkspace` + `PlanilhamentoDiario` em modo "impersonado".
- Seletor: **Time → Closer → Data**.
- Renderiza o `PlanilhamentoDiario` do closer alvo com `effectiveCloserId` passado por prop (em vez de `user.id`).
- Edição completa: todas as ações usam `effectiveCloserId` para inserts/updates; auditoria registra `actor_user_id = financeiro` mas `closer_id = alvo`.
- Realtime via subscription nos `postgres_changes` das duas tabelas (filtradas por `date` + `closer_id`).

---

## 6. Detalhes técnicos

- **Storage**: reutiliza bucket `comprovantes`. Path: `daily-receipts/{team_id}/{closer_id}/{date}/{uuid}.{ext}`.
- **Justificativa**: edits/uploads em dias passados continuam exigindo motivo (>=15 chars) — passa pelo mesmo fluxo `EditReasonModal`.
- **Auditoria**: triggers existentes capturam tudo automaticamente.
- **Nomes & terminologia**: "Comprovantes", "Espelhamento", "Marcar influenciador".
- **Memory**: atualizar `mem://auth/roles-permissions` (adicionar FINANCEIRO global) e criar `mem://features/financeiro-role` + `mem://features/planilhamento-receipts-carousel`.

---

## Ordem de execução
1. Migration: enum + tabela + policies + realtime publication.
2. (após aprovação) Atualizar `useAuth`, `ProtectedRoute`, rotas, Navbar.
3. Refator `PlanilhamentoDiario` → carrossel.
4. Página `/financeiro/comprovantes`.
5. Página `/financeiro/espelhamento` com impersonação + realtime.
6. Atualizar memórias.

## Fora do escopo
- Criação do usuário FINANCEIRO em si (será feita por convite ADMIN existente após o enum estar disponível).
- Mudar dashboards/financeiro do ADMIN.
