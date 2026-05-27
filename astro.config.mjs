// @ts-check
import { defineConfig } from 'astro/config';
import sitemap, { EnumChangefreq } from 'astro-sitemap';
import partytown from '@astrojs/partytown';

// https://astro.build/config
export default defineConfig({
  // Para deploy estático (Vercel, Netlify, Cloudflare Pages, etc.)
  output: 'static',

  // URL do site em produção
  site: 'https://ricardogonzalesoficial.com.br',

  // Revalidação incremental: rebuild só quando necessário
  build: {
    format: 'directory',
  },

  // Integração do sitemap dinâmico
  integrations: [
    sitemap({
      // Incluir todas as rotas estáticas
      changefreq: EnumChangefreq.WEEKLY,
      priority: 0.7,
      lastmod: new Date(),
    }),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
});
