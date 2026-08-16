# Abrir a loja no celular

O `npm run dev` por padrão só aceita conexões do próprio computador
(`localhost`). Pra abrir do celular, dois ajustes:

## 1. Rodar o servidor aceitando a rede local

```
npm run dev -- -H 0.0.0.0
```

## 2. Descobrir o IP do seu computador na rede Wi-Fi

No PowerShell:
```
ipconfig
```
Procura por "Endereço IPv4" da sua placa Wi-Fi -- algo como `192.168.0.15`.

## 3. Acessar do celular

O celular precisa estar **na mesma rede Wi-Fi** que o computador.
Abre o navegador do celular e digita:

```
http://192.168.0.15:3000/loja/login
```
(troca pelo IP que apareceu no passo 2)

## 4. Instalar como app (opcional, mas fica com cara de app de verdade)

- **Android (Chrome)**: menu (⋮) → "Adicionar à tela inicial" ou
  "Instalar app"
- **iPhone (Safari)**: botão de compartilhar (□↑) → "Adicionar à
  Tela de Início"

Depois disso, abre um ícone na tela do celular igual qualquer outro
app, sem barra de endereço do navegador aparecendo.

## Isso funciona pra publicar de verdade?

Não direto -- esse IP só existe enquanto seu computador estiver
ligado, com o `npm run dev` rodando, e o celular na mesma rede. É
ótimo pra **testar** com o celular na mão. Pra ficar acessível de
qualquer lugar (cliente de casa, 3G/4G), o caminho é publicar no
GitHub Pages (já configuramos isso antes -- `DEPLOY_GITHUB_PAGES.md`)
ou outro host. O manifest/ícone que adicionei funciona igual nos
dois casos.
