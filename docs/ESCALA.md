# Vitra: capacidade, velocidade e custo para crescer

> Documento para planejar o crescimento e para usar na venda.
> Medido em 2026-10-29. Refazer o teste a cada mudança grande no banco (`supabase/carga/`).

## Resumo

- **1.000 óticas cabem num único banco médio do Supabase**, com folga.
- As telas respondem no banco em **0,6 a 3 ms** com 1.000 óticas e 600 mil clientes.
- Numa máquina de 2 núcleos, o banco aguentou **cerca de 1.100 aberturas de tela por segundo** com 100 pessoas usando ao mesmo tempo, sem nenhuma falha.
- Custo estimado de infraestrutura com 1.000 óticas: **cerca de US$ 200 a 300 por mês**. A receita seria de 1.000 × R$ 99, ou seja, R$ 99 mil por mês.

## 1. O teste de carga

Os dados foram gerados por `supabase/carga/gerar_dados.sql`, imitando uma ótica pequena ou média de interior.

| Por ótica | Total (1.000 óticas) |
|---|---|
| 600 clientes | 600.000 |
| 300 receitas | 300.000 |
| 400 cards no funil (720 itens de orçamento) | 400.000 (717.000) |
| 250 OS | 250.000 |
| 200 consultas | 200.000 |

Tamanho do banco: **762 MB**. A auditoria cresce com o uso; conte de 2 a 3 vezes esse tamanho ao longo de alguns anos, o que ainda cabe nos 8 GB do plano Pro do Supabase.

### Tempo de cada tela no banco, com RLS ligado, como usuário logado

Medido por `supabase/carga/medir.sql`: mediana de 5 execuções na ótica nº 500, entre as 1.000.

| Tela | Antes da migração 0008 | Depois da 0008 |
|---|---|---|
| Funil de vendas (todos os cards) | 366 ms | **2,0 ms** |
| Busca de cliente por pedaço do nome | 318 ms | **1,2 ms** |
| Quadro do laboratório | 95 ms | **0,8 ms** |
| Relatório do mês | 24 ms | **1,4 ms** |
| Agenda do dia | 9 ms | **0,6 ms** |
| Ficha do cliente | 1,7 ms | **0,7 ms** |
| Mover um card | 2,6 ms | 3,2 ms |

**O que a migração 0008 mudou:** as regras de segurança passaram a calcular "qual é a ótica do usuário" e "o que ele pode fazer" uma vez por consulta, em vez de uma vez por linha. Ela também criou os índices que faltavam e a busca por pedaço do nome (trigram). Sem isso, o funil ficaria cada vez mais lento conforme a base crescesse.

### Usuários simultâneos

Medido por `supabase/carga/simultaneos.pgbench`. Cada transação é um usuário sorteado entre as 1.000 óticas, abrindo o funil, o laboratório ou a busca.

Máquina do teste: 2 núcleos e 7 GB de RAM, parecida com o compute **Large** do Supabase.

| Conexões ao mesmo tempo | Telas por segundo | Tempo médio | Falhas |
|---|---|---|---|
| 10 | 1.157 | 9 ms | 0 |
| 50 | 1.128 | 44 ms | 0 |
| 100 | 980 | 102 ms | 0 |

### Quanto isso representa

Uma pessoa trabalhando no balcão abre ou atualiza uma tela a cada 10 segundos, em média, no pico. Isso dá 0,1 tela por segundo por pessoa.

| Cenário | Pessoas ao mesmo tempo no pico | Telas por segundo | Folga numa máquina de 2 núcleos |
|---|---|---|---|
| 100 óticas × 3 pessoas | 300 | 30 | ~35× |
| 1.000 óticas × 3 pessoas | 3.000 | 300 | ~3,5× |
| 3.000 óticas × 3 pessoas | 9.000 | 900 | no limite: subir para XL (4 núcleos) |

## 2. Plano de crescimento (Supabase + Vercel)

Preços de outubro de 2026 em dólar. Confira antes de fechar contrato.

| Fase | Óticas | Supabase | Vercel | Custo/mês (aprox.) | Receita a R$ 99 |
|---|---|---|---|---|---|
| Piloto | 1–20 | Pro + Micro (US$ 25) | Pro, 1 assento (US$ 20) | **US$ 45** | até R$ 2 mil |
| Interior | 20–200 | Pro + Small/Medium (US$ 30–75) | Pro (US$ 20–40) | **US$ 50–115** | até R$ 20 mil |
| Região | 200–1.000 | Pro + Large (US$ 125) | Pro (US$ 40–100) | **US$ 170–230** | até R$ 99 mil |
| Cidade grande | 1.000–3.000 | Pro + XL ou 2XL (US$ 225–425) | Pro/Enterprise (US$ 100–300) | **US$ 330–730** | até R$ 297 mil |
| Acima de 3.000 | — | Team (US$ 599) + 2XL/4XL, réplica de leitura | Enterprise | sob medida | — |

O tamanho do banco no Supabase muda em minutos, sem trocar código. A aplicação na Vercel escala sozinha.

**Limites a vigiar:**
- **Conexões:** usar sempre o pooler do Supabase, que já é o padrão do supabase-js via API. Ele vai de 200 conexões (Micro) a 1.000 (XL).
- **Tempo real:** 500 conexões simultâneas estão incluídas no Pro. Acima disso, custa US$ 10 a cada 1.000. Com 1.000 óticas e 3 telas abertas em cada uma, são cerca de 3.000 conexões, ou uns US$ 25 por mês a mais.
- **Banda:** fotos de armação e receitas devem ser enviadas em tamanho reduzido; o app reduz antes de enviar.

## 3. Agilidade na tela (o que já está no código e o que falta)

| Técnica | Situação |
|---|---|
| **Atualização otimista:** o card muda na hora e o banco confirma por trás | ✅ funil e laboratório |
| **Tempo real:** quando outra área move um card, a tela atualiza sozinha | 🟡 quadro do laboratório, produção e funil (migração 0006 liga o Realtime) |
| **Esqueleto de carregamento** (`loading.tsx`), sem tela branca entre páginas | 🟡 |
| **Pré-carregamento de links** (Next.js `<Link>`) | ✅ padrão do Next.js |
| **Banco e aplicação na mesma região** (São Paulo: Supabase `sa-east-1`, Vercel `gru1`) | ⬜ configurar no deploy; é o que mais pesa na velocidade sentida no Brasil |
| Paginação nas listas grandes (clientes, histórico) | ✅ clientes limitam a 100 por busca |

## 4. Quando pensar em algo diferente

- **Sistema instalado na máquina:** só para hardware que o navegador não alcança, como TEF (maquininha integrada) ou impressora fiscal antiga. Nesse caso, um pequeno programa local conversa com o Vitra na nuvem. Nota fiscal não precisa disso: dá para emitir por API (Focus NFe, NFe.io e similares).
- **Sem internet na loja:** o PWA pode guardar a agenda e a fila do dia offline. Fica para a Versão 2.
- **Banco separado por cliente grande:** só para uma rede que exija isso em contrato. O desenho por `otica_id` + RLS permite mover uma ótica para outro banco sem mudar o código.

## Como repetir o teste

```bash
createdb carga
psql -d carga -f supabase/tests/stub_supabase.sql
for m in supabase/migrations/0*.sql; do psql -d carga -v ON_ERROR_STOP=1 -f "$m"; done
psql -d carga -f supabase/carga/gerar_dados.sql      # ~40 s
psql -d carga -f supabase/carga/medir.sql
psql -d carga -c "create table carga_usuarios as select row_number() over (order by u.otica_id) as n, u.id from usuarios u join perfis p on p.id = u.perfil_id where p.chave = 'dono'; create index on carga_usuarios(n); grant select on carga_usuarios to authenticated;"
pgbench -n -f supabase/carga/simultaneos.pgbench -c 50 -j 4 -T 20 carga
```

Fontes de preço: [Supabase: preços e compute](https://supabase.com/docs/pricing) · [Custos da Vercel em 2026 (MakerKit)](https://makerkit.dev/blog/saas/vercel-cost)
