import { baseUrl } from 'lib/utils';
import type { MetadataRoute } from 'next';

const staticRoutes = ['', '/login', '/register'];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString()
  }));
}
