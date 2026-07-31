# PDV do mercado — app real (Next.js + Supabase)

Isso é o app de verdade, não mockup. Ele lê e escreve direto no seu
projeto Supabase.

## Passo a passo

### 1. Achar suas chaves
Veja `COMO_ACHAR_CHAVES.md`.

### 2. Configurar o projeto
```bash
npm install
cp .env.local.example .env.local
```
Edite `.env.local` e cole sua **Project URL** e **anon key**.

### 3. Ativar o Realtime na tabela pedidos
Sem isso o PDV não atualiza sozinho quando um pedido novo chega.
No painel do Supabase: **Database → Replication** → encontre a
tabela `pedidos` → ative o toggle. Repita para `itens_pedido` se
quiser que a lista de itens também atualize ao vivo.

### 4. Garantir que você tem um operador de teste
Você já criou isso lá atrás (Authentication → Users), com o papel
promovido pra `operador_pdv` na tabela `perfis`. Se não lembra a
senha, pode resetar direto pelo painel do Supabase.

### 5. Rodar
```bash
npm run dev
```
Abre em `http://localhost:3000`, você cai na tela de login.
Entra com o e-mail/senha do operador de teste.

### 6. Ver um pedido de verdade aparecer
Como o app do cliente ainda não existe, crie um pedido manualmente
pelo SQL Editor do Supabase — o passo a passo está em
`CRIAR_PEDIDO_TESTE.sql`. Assim que você rodar o insert, o pedido
deve aparecer na tela do PDV automaticamente (graças ao Realtime),
sem precisar dar refresh.

### 7. Testar o fluxo
Clica no pedido, clica em "Confirmar separação" — isso muda o
`status` no banco de verdade, o que já aciona os triggers que
criamos: desconta o estoque de verdade e libera/ocupa entregador
conforme o caso.

## Retaguarda (fornecedores, contas a pagar, importar compra)

Acessível em `/admin`, com o mesmo login de operador. Pra "Importar
XML de compra" funcionar, o microsserviço fiscal (`microsservico-fiscal`)
precisa estar rodando -- veja o README dele. Configura a URL e o
token dele no `.env.local` (`NEXT_PUBLIC_MICROSSERVICO_URL` e
`NEXT_PUBLIC_MICROSSERVICO_TOKEN`).

**Aviso de segurança**: como esse token vai com o prefixo
`NEXT_PUBLIC_`, ele fica visível no navegador (qualquer um que abrir
o DevTools consegue ver). Isso é aceitável enquanto for uma
ferramenta de uso interno, numa rede que só o mercado acessa -- mas
se um dia você publicar essa tela de retaguarda num domínio público,
o certo é mover essa chamada pra um backend que guarde o token em
segredo, em vez de chamar o microsserviço direto do navegador.

## Se der erro

- **"new row violates row-level security policy"** → o usuário
  logado não está com papel `operador_pdv` ou `admin` na tabela
  `perfis`. Confirma isso no SQL Editor:
  `select papel from perfis where id = auth.uid();` (rodando
  autenticado) ou veja direto na tabela.
- **Pedido não aparece mesmo depois do insert** → confirma se
  ativou o Realtime no passo 3.
- **"Failed to fetch" no login** → confere se a URL no `.env.local`
  está exatamente igual à do painel, sem barra no final.
