import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react()],
        define: {
            'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'https://unipoint.ngtukien.id.vn/api'),
            'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(env.VITE_API_PROXY_TARGET || 'https://unipoint.ngtukien.id.vn'),
        },
        server: {
            host: '0.0.0.0',
            port: 3000,
            proxy: {
                '/api': {
                    // Sử dụng env.VITE_API_PROXY_TARGET thay cho import.meta.env
                    target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
                    changeOrigin: true,
                }
            }
        }
    }
})