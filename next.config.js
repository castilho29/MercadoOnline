// O basePath só existe quando estamos gerando o build pro GitHub Pages
// (npm run build com GITHUB_PAGES=true). No dia a dia local (npm run dev),
// não é aplicado -- assim localhost:3000 funciona normal, sem prefixo.
const paraGithubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Troque "pdv-mercado" pelo nome exato do seu repositório no GitHub.
  // Se o repositório se chamar "usuario.github.io" (página de usuário,
  // não de projeto), REMOVA basePath e assetPrefix completamente.
  basePath: paraGithubPages ? '/MercadoOnline' : '',
  assetPrefix: paraGithubPages ? '/MercadoOnline/' : '',
  trailingSlash: true,
  images: {
    unoptimized: true, // a otimização de imagem do Next precisa de servidor, exportação estática não tem
  },
};

module.exports = nextConfig;
