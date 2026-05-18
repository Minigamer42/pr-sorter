import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localCustomizeWriter } from './dev/localCustomizeWriter';

export default defineConfig({
    base: './',
    plugins: [react(), localCustomizeWriter()],
});
