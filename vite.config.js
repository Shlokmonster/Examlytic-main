import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import commonjs from 'vite-plugin-commonjs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    commonjs(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
      // Enable esbuild polyfill plugins
      plugins: [
        {
          name: 'fix-node-globals-polyfill',
          setup(build) {
            build.onResolve({ filter: /_virtual-process-polyfill_/ }, args => ({
              path: args.path,
              external: true
            }))
          },
        },
      ],
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    'process.browser': true,
    'process.env.NODE_DEBUG': false,
    'process.env.NODE_ENV': '"development"',
    'process.platform': '"browser"',
    'process.version': '"v16.0.0"',
  },
  resolve: {
    alias: {
      // Handle TensorFlow.js and related dependencies
      '@tensorflow/tfjs$': '@tensorflow/tfjs/dist/tf.es2017.js',
      'long': 'long/index.js',
      // Add any other problematic modules here
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
      exclude: [],
    },
    rollupOptions: {
      plugins: [
        // Force CommonJS modules to be bundled
        {
          name: 'force-commonjs',
          resolveId(source) {
            if (source.includes('@tensorflow/')) {
              return { id: source, external: false };
            }
            return null;
          },
        },
      ],
    },
  },
})
