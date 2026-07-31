-- ============================================================
-- Cria um pedido de teste pra você ver aparecendo no PDV
-- Rode no SQL Editor do Supabase (roda como superusuário,
-- então ignora o RLS -- serve só pra teste)
-- ============================================================

-- 1) Pegue o id de um cliente de teste (o que você criou antes)
-- select id from auth.users where email = 'cliente.teste@exemplo.com';

-- 2) Crie um endereço pra esse cliente (troque o uuid abaixo)
insert into public.enderecos (usuario_id, rua, numero, cidade, estado, cep)
values (
  (select id from auth.users where email = 'cliente.teste@exemplo.com'),
  'Rua Teste', '100', 'Belém', 'PA', '66000-000'
);

-- 3) Crie o pedido apontando pro cliente e endereço criados
insert into public.pedidos (cliente_id, endereco_id)
values (
  (select id from auth.users where email = 'cliente.teste@exemplo.com'),
  (select id from public.enderecos where rua = 'Rua Teste' order by criado_em desc limit 1)
)
returning id; -- copie o id retornado, vai usar no próximo passo

-- 4) Adicione itens ao pedido (troque <ID_DO_PEDIDO> pelo id retornado acima
--    e ajuste os nomes de produto pros que você já cadastrou)
insert into public.itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
select
  '<ID_DO_PEDIDO>',
  id,
  2,
  preco
from public.produtos
where nome = 'Banana prata (kg)';

insert into public.itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
select
  '<ID_DO_PEDIDO>',
  id,
  1,
  preco
from public.produtos
where nome = 'Refrigerante 2L';

-- O total do pedido é calculado sozinho pelo trigger que já criamos.
-- Assim que rodar os inserts acima, o pedido deve aparecer no PDV
-- (se o Realtime estiver ativado -- veja o README).
