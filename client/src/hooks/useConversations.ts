import { useMutation } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type ConversationResponse = {
  conversationId: string;
};

async function createConversation(): Promise<ConversationResponse> {
  const url = `${API_BASE}/api/conversations`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function useConversations() {
  return useMutation({ mutationFn: createConversation });
}
