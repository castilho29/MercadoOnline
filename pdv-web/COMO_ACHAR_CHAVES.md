# Onde achar suas chaves do Supabase

1. Entre em https://supabase.com/dashboard e abra o seu projeto
2. No menu lateral, clique em **Project Settings** (ícone de engrenagem, embaixo)
3. Clique em **API**
4. Você vai ver:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - **anon / public key** → uma chave longa, começa com `eyJ...` — essa é segura
     pra usar no navegador (o RLS que criamos protege os dados)
   - **service_role key** → outra chave `eyJ...` — **essa NUNCA vai no app do
     navegador**, ela ignora todo o RLS. Só usamos ela no microsserviço PHP
     que já criamos.

Copie a **Project URL** e a **anon key** — são essas duas que vamos usar agora
no app do PDV.
