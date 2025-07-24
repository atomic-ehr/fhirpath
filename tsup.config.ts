import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node22',
  splitting: false,
  sourcemap: true,
  minify: false,
  treeshake: true,
})
