import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type HelloResponse = {
  message: string;
};

async function fetchHello(): Promise<HelloResponse> {
  const url = `${API_BASE}/api/hello`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function useHello() {
  return useQuery({ queryKey: ['hello'], queryFn: fetchHello, enabled: false });
}

