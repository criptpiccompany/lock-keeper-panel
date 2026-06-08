---
name: commission-tiers-logic
description: Valores reais dos tiers de comissão (cartões Performance Club) por faturamento mensal
type: rule
---
Os tiers de comissão são exibidos pelos cartões Performance Club na Home (não mais pelo termômetro). Valores reais por faturamento mensal do closer (tabela `commission_tiers`, `team_id='default'`):

| tier_order | Nível    | % Comissão | Faturamento (R$) |
|------------|----------|------------|------------------|
| 0          | (base)   | 10%        | 0                |
| 1          | SILVER   | 15%        | 70.000           |
| 2          | GOLD     | 20%        | 160.000          |
| 3          | PLATINUM | 25%        | 220.000          |
| 4          | BLACK    | 30%        | 300.000          |
| 5          | DIAMOND  | 33%        | 380.000          |
| 6          | OBSIDIAN | 35%        | 450.000          |
