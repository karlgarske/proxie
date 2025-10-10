import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type ClassificationResponse = {
  description: string | null;
  score: number;
  backdrops: { url: string; description: string; attribution: string }[];
  suggestions: string[];
};

async function fetchClassification(text: string): Promise<ClassificationResponse> {
  const params = new URLSearchParams({ text });
  const url = `${API_BASE}/api/classify?${params.toString()}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function useClassify(text: string) {
  return useQuery({
    queryKey: ['classify', text],
    queryFn: () => fetchClassification(text),
    enabled: Boolean(text?.trim()),
  });
}
