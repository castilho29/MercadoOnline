# Publicar o PDV + Loja no GitHub Pages

## 1. Ajuste o `next.config.js`
Abra o arquivo e troque `pdv-mercado` pelo nome real do repositório que
você vai criar no GitHub. Se o repositório se chamar exatamente
`SEUUSUARIO.github.io`, apague as linhas `basePath` e `assetPrefix`.

## 2. Crie o repositório e suba o código
```bash
cd pdv-web
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEUUSUARIO/pdv-mercado.git
git push -u origin main
```

**Importante**: o `.env.local` (com suas chaves) já deve estar sendo
ignorado pelo git — se não tiver um `.gitignore`, crie um com a linha
`.env.local` dentro, senão sua chave vai parar num repositório público.

## 3. Cadastre as chaves como Secrets do repositório
No GitHub: **Settings → Secrets and variables → Actions → New repository
secret**. Crie dois secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(Mesmo sendo uma chave "pública", publicá-la direto no código não é boa
prática — usar Secrets custa zero trabalho a mais e evita hábito ruim.)

## 4. Ative o GitHub Pages
No repositório: **Settings → Pages → Build and deployment → Source**,
escolha **GitHub Actions** (não "Deploy from a branch").

## 5. Rode o deploy
Basta dar `git push` — o workflow que já está em
`.github/workflows/deploy.yml` builda e publica sozinho. Acompanhe em
**Actions** no menu do repositório.

## 6. Acesse
Fica em `https://SEUUSUARIO.github.io/pdv-mercado/` (ou na raiz, se
usou repositório do tipo `SEUUSUARIO.github.io`).

## Lembrete sobre o Realtime
O PDV depende do Supabase Realtime pra atualizar sozinho — isso
continua funcionando normalmente no GitHub Pages, porque é uma conexão
que o navegador do usuário abre direto com o Supabase, sem passar pelo
GitHub Pages. Não precisa de nada especial pra isso funcionar em
produção.

## O que NÃO vai pro GitHub Pages
O microsserviço fiscal (PHP/NFePHP) continua precisando de um host que
rode PHP de verdade — Railway ou Render, como já combinamos. GitHub
Pages serve só HTML/CSS/JS estático.
