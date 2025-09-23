import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ConversationStreamProps = {
  conversationId?: string;
  promptText?: string;
  submissionKey?: number;
  debug?: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function ConversationStream({
  conversationId,
  promptText,
  submissionKey,
  debug = false,
}: ConversationStreamProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'finished' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [responseId, setResponseId] = useState<string | null>(null);
  const responseIdRef = useRef<string | null>(null);
  const hasReceivedStreamContentRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !promptText || submissionKey == null) {
      setStatus('idle');
      setError(null);
      setTranscript('');
      setResponseId(null);
      responseIdRef.current = null;
      hasReceivedStreamContentRef.current = false;
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setTranscript('');
    setResponseId(null);
    hasReceivedStreamContentRef.current = false;

    const handleEvent = (payload: string) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(payload);
        console.log('SSE event', parsed);
        if (parsed?.event === 'data' && typeof parsed.text === 'string') {
          hasReceivedStreamContentRef.current = true;
          setTranscript((prev) => prev + parsed.text);
        } else if (
          parsed?.event === 'ended' &&
          parsed?.result &&
          typeof parsed.result === 'object' &&
          typeof parsed.result.responseId === 'string'
        ) {
          responseIdRef.current = parsed.result.responseId;
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
            responseId: responseIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error(`Status:${response.status} - ${response.body}`);
          let message = `Oops! Something went wrong :( Try refreshing.`;
          if (response.status == 404)
            message = `It looks like our conversation automatically expired to help protect our privacy. Please refresh.`;
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error('Yikes! I had trouble responding :(');
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

  const showLoadingMessage =
    status === 'streaming' && !hasReceivedStreamContentRef.current && !error;

  return (
    <>
      {debug && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Debug</p>
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
        </div>
      )}

      {showLoadingMessage && <p className="text-sm text-muted-foreground">Thinking…</p>}
      <div className="markdown-container">
        {error && <p className="text-red-600">{error}</p>}
        <ReactMarkdown remarkPlugins={[remarkGfm]} children={transcript} />
      </div>
    </>
  );
}
