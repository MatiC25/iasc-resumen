# Resumen de IASC

[Leer el resumen en GitHub Pages](https://matic25.github.io/iasc-resumen/).

El contenido está en `src/content/docs/`. Los PDF y diagramas se sirven desde `public/`.

## Desarrollo local

```sh
npm ci
npm run dev -- --background
```

Usá `npm run astro -- dev stop` para detener el servidor y `npm run build` para compilar.

GitHub Actions publica en Pages cada push a `main`.
