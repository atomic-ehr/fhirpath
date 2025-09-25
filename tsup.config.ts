import { defineConfig } from 'tsup'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))

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
  define: {
    __VERSION__: JSON.stringify(packageJson.version)
  }
})
