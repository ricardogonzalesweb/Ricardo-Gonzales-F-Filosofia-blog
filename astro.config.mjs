// @ts-check
import { defineConfig } from 'astro/config';
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

  // Sitemap agora é gerado dinamicamente em src/pages/sitemap.xml.ts
  // (astro-sitemap não funciona com output: 'server')
  integrations: [
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
});
