// @ts-check
import { defineConfig } from 'astro/config';
import sitemap, { EnumChangefreq } from 'astro-sitemap';
import partytown from '@astrojs/partytown';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Modo servidor com ISR: páginas são renderizadas sob demanda
  // e revalidadas automaticamente a cada 5 minutos pela Vercel
  output: 'server',
  adapter: vercel({
    isr: {
      // Revalida as páginas a cada 5 minutos (300 segundos)
      expiration: 300,
    },
  }),

  // URL do site em produção
  site: 'https://ricardogonzalesoficial.com.br',

  // Formato de build
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
