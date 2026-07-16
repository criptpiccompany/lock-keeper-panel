# Migração do CriptPic Board para a Hostinger

## Arquitetura-alvo

- Frontend React compilado e servido por Nginx em container sem privilégios.
- Supabase autogerenciado em containers separados para Postgres, Auth, Storage,
  Realtime, REST e Edge Functions.
- Proxy HTTPS na frente dos serviços; somente portas 80 e 443 públicas.
- Scrapers executados como tarefas isoladas, com segredos fora do Git.
- Backups criptografados do Postgres e do Storage enviados para destino externo.

## Etapas

1. Publicar apenas o frontend em um subdomínio de homologação.
2. Exportar esquema, dados, usuários e arquivos do backend atual.
3. Subir o Supabase autogerenciado e aplicar as migrations em ordem.
4. Importar dados e Storage; validar Auth, RLS e URLs assinadas.
5. Migrar e agendar `influboard-scrape`, `megaarena-scrape` e
   `megaarena-close-window` no fuso `America/Sao_Paulo`.
6. Substituir a dependência `LOVABLE_API_KEY` do OCR por um provedor próprio.
7. Validar CLOSER, ADMIN e FINANCEIRO em homologação.
8. Trocar o DNS somente após backup e teste de rollback.

## Publicação do frontend

Copie `.env.production.example` para um arquivo de ambiente fora do Git e execute:

```sh
docker compose --env-file /caminho/seguro/criptpic.env \
  -f compose.production.yaml up -d --build
```

Valide:

```sh
curl --fail http://127.0.0.1:8080/healthz
```

## Regras de segurança

- Nunca versionar senhas, cookies dos scrapers ou `SUPABASE_SERVICE_ROLE_KEY`.
- Não expor Postgres, Studio, Storage ou portas internas diretamente à internet.
- Aplicar migrations antes de publicar um frontend que dependa delas.
- Fazer backup antes de cada migration e manter um procedimento de rollback.
- Separar homologação e produção, inclusive banco e chaves.
