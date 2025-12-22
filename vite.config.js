
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    base: './', // Ensure relative paths for file:// protocol
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: false, // Fix ReferenceError by disabling minification
        rollupOptions: {
            input: {
                editor: resolve(__dirname, 'src/editor/index.html'),
                background: resolve(__dirname, 'src/background.js'),
                content: resolve(__dirname, 'src/content.js'),
                popup: resolve(__dirname, 'src/popup.html')
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    return 'assets/[name].js';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    }
});
