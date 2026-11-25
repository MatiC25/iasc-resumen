// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import { obsidianImages } from './src/markdown/obsidian-images.mjs';
import { prefixContentUrls } from './src/markdown/prefix-content-urls.mjs';

const base = (process.env.PAGES_BASE ?? '').replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
	site: process.env.PAGES_SITE,
	base: base || '/',
	markdown: { processor: satteri({ mdastPlugins: [obsidianImages(base), ...(base ? [prefixContentUrls(base)] : [])] }) },
	integrations: [
		react(),
		starlight({
			title: 'IASC',
			tableOfContents: false,
			components: { Search: './src/components/DevSearch.astro', Head: './src/components/MermaidHead.astro' },
			customCss: ['./src/styles/pdf-viewer.css', './src/styles/sidebar.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/MatiC25/iasc-resumen' }],
			sidebar: [
				{
					label: 'Introducción',
					items: [{ autogenerate: { directory: 'Introduccion' } }],
				},
				{
					label: 'Corutinas',
					items: [{ autogenerate: { directory: 'corutinas' } }],
				},
				{
					label: 'Programación funcional',
					items: [{ autogenerate: { directory: 'funcional' } }],
				},
				{
					label: 'STM',
					items: [{ autogenerate: { directory: 'stm' } }],
				},
				{
					label: 'Elixir',
					items: [{ autogenerate: { directory: 'elixir' } }],
				},
				{
					label: 'Distribución',
					items: [{ autogenerate: { directory: 'distribucion' } }],
				},
				{
					label: 'Materiales',
					items: [
						{ slug: 'practica/simulacro-parcial-1', label: 'Simulacro del Parcial 1' },
						{ slug: 'practica/simulacro-2-parcial-1', label: 'Simulacro 2 del Parcial 1' },
						{
							label: 'Ejemplos de código',
							items: [{ autogenerate: { directory: 'ejemplos' } }],
						},
						{
							label: 'Archivos',
							items: [{ autogenerate: { directory: 'guides' } }],
						},
					],
				},
				{
					label: 'Adicionales',
					items: [
						{ slug: 'adicionales', label: 'Recursos complementarios' },
						{ slug: 'adicionales/como-escalo-dropbox', label: 'Cómo escaló Dropbox' },
					],
				},
			],
		}),
	],
});
