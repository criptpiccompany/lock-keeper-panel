# Scraping MegaArena — Painel de Afiliados

## Objetivo
Monitorar quanto cada afiliado depositou na janela **09h→09h (BRT)**, com sync automático a cada 3 min e histórico permanente, espelhando o padrão do Influboard.

## Como resolver a janela 09h→09h
O painel filtra "Depositado" por período (Hoje/Ontem/Mês) — o menor recorte é diário (00h→00h). Solução:

1. A cada 3 min, o scraper captura a tabela com filtro **"Hoje"** — snapshot do `depositado_hoje` acumulado por afiliado (00h até agora).
2. Guarda cada snapshot numa tabela de séries temporais.
3. Diariamente às 09h05, um job calcula:  
   `janela_9h_ontem_até_9h_hoje = (total_ontem − snapshot_ontem_09h) + snapshot_hoje_09h`
4. Grava o resultado consolidado numa tabela histórica por afiliado × dia-de-janela.

Isso dá o valor **exato** da janela 09h→09h para cada afiliado.

## Escopo

### 1. Backend (Lovable Cloud)

**Novas tabelas:**
- `megaarena_afiliados` — cadastro dos afiliados (id externo, nome, email, closer, cadastro).
- `megaarena_snapshots` — série temporal: `afiliado_id, captured_at, depositado_hoje, comissao_hoje, sacado, indicados, ativos, status`.
- `megaarena_janela_9h` — consolidado diário por janela: `afiliado_id, janela_date (dia da abertura 09h), depositado_janela, comissao_janela, closer_name`.
- `megaarena_sync_meta` — meta do último sync (timestamp, status, erro, count).

**Novas edge functions:**
- `megaarena-scrape` — faz login em `/adm/login`, GET em `/adm/planos?periodo=hoje` paginado (81 registros, 10 por página → 9 páginas), extrai tabela, grava snapshot.
- `megaarena-close-window` — roda 1x/dia às 09h05, calcula a janela 09h→09h do dia anterior e grava em `megaarena_janela_9h`.

**Cron jobs (pg_cron):**
- `megaarena-scrape` a cada 3 min.
- `megaarena-close-window` diariamente às 09h05 BRT (12h05 UTC).

**Secrets:** `MEGAARENA_EMAIL` e `MEGAARENA_PASSWORD` (a fornecer via update_secret).

### 2. Frontend

Nova rota `/megaarena-afiliados` (linkada no menu de admin, próxima ao Influboard Test):

- **Header** com stats: total afiliados, última sync, status.
- **Filtro de data** (padrão: janela de ontem→hoje 09h).
- **Tabela principal** ordenada por `depositado_janela` desc, colunas: Afiliado, Closer, Indicados, Ativos, **Depositado na janela**, Comissão, Status.
- **Busca** por afiliado/email/closer.
- **Botão "Atualizar agora"** para sync manual.
- **Gráfico opcional (fase 2):** série temporal de depositado por afiliado ao longo do dia.

### 3. Fluxo do scraper (Laravel — mesmo padrão do Influboard)
1. GET `/adm/login` para obter XSRF-TOKEN.
2. POST `/adm/login` com email/senha.
3. Para cada página (1..N), GET `/adm/planos?periodo=hoje&page=X` (ou requisição JSON se houver).
4. Parse do HTML/JSON da tabela.
5. Insert em `megaarena_snapshots` + upsert em `megaarena_afiliados`.
6. Update em `megaarena_sync_meta`.

## O que fica pronto
- Sync automático a cada 3 min.
- Histórico permanente de snapshots (auditoria).
- Consolidação diária exata da janela 09h→09h.
- Página de visualização integrada ao app.

## O que preciso de você antes de rodar
1. **Salvar as credenciais** que você mandou como secrets `MEGAARENA_EMAIL` / `MEGAARENA_PASSWORD` (faço com `add_secret` — abre form seguro pra você colar).
2. Confirmar se o menu deve mostrar o link "MegaArena Afiliados" pra todos os ADMIN ou só pra você.

## Observações
- O primeiro cálculo da janela 09h→09h só terá valor completo **24h após** o primeiro snapshot bem-sucedido (precisa de snapshot às 09h de 2 dias diferentes).
- Se o painel MegaArena tiver rate-limit ou detecção de bot, ajusto (delays entre páginas, User-Agent, etc).
- A tabela `megaarena_snapshots` cresce ~23k rows/dia (81 afiliados × 480 syncs). Adiciono política de retenção de 90 dias.
