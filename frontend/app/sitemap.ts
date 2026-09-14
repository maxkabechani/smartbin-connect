import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://smartbin.maxkabechani.dev'
  return ['/','/dashboard','/bins','/dispatch','/ai'].map((path) => ({ url: `${base}${path}`, changeFrequency: 'daily', priority: path === '/' || path === '/dashboard' ? 1 : 0.8 }))
}
