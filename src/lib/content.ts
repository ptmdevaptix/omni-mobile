import { api } from './api';

export type SiteContent = { slug: string; title: string; updated?: string; markdown: string };

// Static info/legal page content (markdown), served by omni-hockey's /api/site-content/[slug].
export const fetchSiteContent = (slug: string) => api<SiteContent>(`/site-content/${slug}`);
