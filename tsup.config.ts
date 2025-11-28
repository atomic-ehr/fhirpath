import { defineConfig } from 'tsup'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
  entry: ['src/index.node.ts', 'src/index.browser.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'es2024',
  splitting: false,
  sourcemap: true,
  minify: false,
  treeshake: true,
  define: {
    __VERSION__: JSON.stringify(packageJson.version)
  }
})
