import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type ConversationStreamProps = {
  conversationId?: string;
  promptText?: string;
  submissionKey?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function ConversationStream({
  conversationId,
  promptText,
  submissionKey,
}: ConversationStreamProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'finished' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [responseId, setResponseId] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !promptText || submissionKey == null) {
      setStatus('idle');
      setError(null);
      setTranscript('');
      setResponseId(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setTranscript('');
    setResponseId(null);

    const handleEvent = (payload: string) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(payload);
        console.log('SSE event', parsed);
        if (parsed?.event === 'data' && typeof parsed.text === 'string') {
          setTranscript((prev) => prev + parsed.text);
        } else if (
          parsed?.event === 'ended' &&
          parsed?.result &&
          typeof parsed.result === 'object' &&
          typeof parsed.result.responseId === 'string'
        ) {
          setResponseId(parsed.result.responseId);
        }
      } catch (jsonError) {
        console.log('SSE event', payload);
      }
    };

    const processLine = (line: string) => {
      const dataPayload = line.replace(/^data:\s*/, '');
      handleEvent(dataPayload);
    };

    const stream = async () => {
      setStatus('connecting');
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/response/sse`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            text: promptText,
            responseId: responseId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Readable stream missing from response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const flushBuffer = () => {
          buffer
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .forEach(processLine);
          buffer = '';
        };

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          setStatus('streaming');

          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex).trim();
            buffer = buffer.slice(separatorIndex + 2);
            separatorIndex = buffer.indexOf('\n\n');

            rawEvent
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .forEach(processLine);
          }
        }

        if (buffer.trim().length) {
          flushBuffer();
        }

        if (!cancelled) {
          setStatus('finished');
        }
      } catch (streamError) {
        if ((streamError as DOMException).name === 'AbortError') {
          return;
        }
        setStatus('error');
        setError((streamError as Error).message);
        console.error('SSE error', streamError);
      }
    };

    stream();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conversationId, promptText, submissionKey]);

  if (!conversationId) {
    return null;
  }

  return (
    <div className="p-4 rounded-md border space-y-2">
      <p className="text-sm font-medium">Streaming conversation…</p>
      <dl className="text-xs space-y-1">
        <div>
          <dt className="font-semibold">Conversation ID</dt>
          <dd className="truncate">{conversationId}</dd>
        </div>
        <div>
          <dt className="font-semibold">Status</dt>
          <dd className="capitalize">{status}</dd>
        </div>
        {responseId && (
          <div>
            <dt className="font-semibold">Response ID</dt>
            <dd className="truncate">{responseId}</dd>
          </div>
        )}
      </dl>
      {error && <p className="text-xs text-red-600">Error: {error}</p>}
      <ReactMarkdown className="text-sm whitespace-pre-wrap">{transcript}</ReactMarkdown>
    </div>
  );
}
