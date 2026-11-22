import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` regenerates the PNG app icons from public/app-icon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#FFF8EC' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#FFF8EC' } },
  },
  images: ['public/app-icon.svg'],
})
