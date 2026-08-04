import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  // transformers.js 在 Web Worker 中运行，worker 需 ES 模块格式以支持代码分割；
  // 开发模式下排除预打包，避免 onnxruntime 被重复优化导致 worker 加载异常
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  server: {
    port: 3000,
    // /api 转发给本地讯飞 ISE 评测代理（npm run server 启动，默认端口 8787）
    proxy: { '/api': 'http://localhost:8787' },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
