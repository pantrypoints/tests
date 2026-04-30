import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';


export default defineConfig({
  plugins: [sveltekit(), tailwindcss(), devtoolsJson()],
  optimizeDeps: {
    // include: ['lucide-svelte', '@lucide/svelte'],
    exclude: ['leaflet']
  },
  // ssr: {
  //   noExternal: ['lucide-svelte', '@lucide/svelte']
  // }  
});


