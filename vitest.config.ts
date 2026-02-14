import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Sequential file execution avoids connection pressure from parallel workers.
    fileParallelism: false,
  },
})
