import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../../api/openapi.yaml',
  output: {
    path: 'src/generated',
    postProcess: ['prettier'],
  },
  plugins: ['@hey-api/typescript'],
})
