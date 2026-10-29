-- Catálogo inicial de exemplo para a ótica de nome 'Ótica Ômega'. Rode no SQL Editor do Supabase.
-- Ajuste os preços na tela de catálogo (a tela ainda não existe) ou direto aqui antes de rodar.
insert into catalogo_itens (otica_id, categoria, nome, preco)
select o.id, v.categoria, v.nome, v.preco
from oticas o,
     (values
       ('lente',         'Lente visão simples 1.56',       240.00),
       ('lente',         'Lente visão simples 1.67',       480.00),
       ('lente',         'Lente multifocal 1.60 (par)',    980.00),
       ('tratamento',    'Antirreflexo',                   180.00),
       ('tratamento',    'Fotossensível',                  320.00),
       ('armacao',       'Armação acetato',                290.00),
       ('armacao',       'Armação metal leve',             380.00),
       ('lente_contato', 'Lente de contato mensal (caixa)',160.00),
       ('acessorio',     'Estojo e flanela',                20.00),
       ('servico',       'Ajuste e montagem',               60.00)
     ) as v(categoria, nome, preco)
where o.nome = 'Ótica Ômega'
  and not exists (select 1 from catalogo_itens c where c.otica_id = o.id);
