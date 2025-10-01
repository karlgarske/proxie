import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export enum ConversationStreamStatus {
  Idle = 'idle',
  Connecting = 'connecting',
  Streaming = 'streaming',
  Finished = 'finished',
  Error = 'error',
}

export type ConversationStreamEvent =
  | { type: 'status'; status: ConversationStreamStatus }
  | { type: 'chunk'; text: string }
  | { type: 'response-ended'; responseId: string }
  | { type: 'error'; error: string };

type ConversationStreamProps = {
  conversationId?: string;
  promptText?: string;
  submissionKey?: number;
  debug?: boolean;
  onEvent?: (event: ConversationStreamEvent) => void;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function ConversationStream({
  conversationId,
  promptText,
  submissionKey,
  debug = false,
  onEvent,
}: ConversationStreamProps) {
  const [status, setStatus] = useState<ConversationStreamStatus>(ConversationStreamStatus.Idle);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [responseId, setResponseId] = useState<string | null>(null);
  const responseIdRef = useRef<string | null>(null);
  const hasReceivedStreamContentRef = useRef(false);

  const dispatchStreamEvent = useCallback(
    (event: ConversationStreamEvent) => {
      onEvent?.(event);
    },
    [onEvent]
  );

  const updateStatus = useCallback(
    (nextStatus: ConversationStreamStatus) => {
      setStatus(nextStatus);
      dispatchStreamEvent({ type: 'status', status: nextStatus });
    },
    [dispatchStreamEvent]
  );

  useEffect(() => {
    dispatchStreamEvent({ type: 'status', status: ConversationStreamStatus.Idle });
  }, [dispatchStreamEvent]);

  useEffect(() => {
    if (!conversationId || !promptText || submissionKey == null) {
      //there is no need for a stream yet
      updateStatus(ConversationStreamStatus.Idle);
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
        //console.log('SSE event', parsed);
        if (parsed?.event === 'data' && typeof parsed.text === 'string') {
          hasReceivedStreamContentRef.current = true;
          setTranscript((prev) => prev + parsed.text);
          dispatchStreamEvent({ type: 'chunk', text: parsed.text });
        } else if (
          parsed?.event === 'ended' &&
          parsed?.result &&
          typeof parsed.result === 'object' &&
          typeof parsed.result.responseId === 'string'
        ) {
          responseIdRef.current = parsed.result.responseId;
          setResponseId(parsed.result.responseId);
          dispatchStreamEvent({
            type: 'response-ended',
            responseId: parsed.result.responseId,
          });
        }
      } catch (jsonError) {
        console.log('SSE event', payload);
      }
    };

    const processLine = (line: string) => {
      const dataPayload = line.replace(/^data:\s*/, '');
      handleEvent(dataPayload);
    };

    const handleStreamError = (streamError: unknown) => {
      if ((streamError as DOMException).name === 'AbortError') {
        return;
      }
      const errorMessage = (streamError as Error).message;
      updateStatus(ConversationStreamStatus.Error);
      setError(errorMessage);
      dispatchStreamEvent({ type: 'error', error: errorMessage });
      console.error('SSE error', streamError);
    };

    const fetchResponse = async () => {
      //using fetch instead of EventSource to be able to send cookies and use POST
      return await fetch(`${API_BASE}/api/response/sse`, {
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
    };

    const fetchResponseReader = async () => {
      const response = await fetchResponse();

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

      return response.body.getReader();
    };

    const stream = async () => {
      updateStatus(ConversationStreamStatus.Connecting);
      setError(null);

      try {
        const reader = await fetchResponseReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          //keep reading each data chunk into buffer as it comes in as long as not cancelled by unmount or deps change
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            break;
          }

          //append the decoded value to the buffer
          buffer += decoder.decode(value, { stream: true });
          updateStatus(ConversationStreamStatus.Streaming);

          //process any full events (separated by double newlines)
          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            // there is at least one full event in the buffer to process
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
          //flush any remaining data in the buffer that didn't end in double newlines
          buffer
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .forEach(processLine);
          buffer = '';
        }

        if (!cancelled) {
          updateStatus(ConversationStreamStatus.Finished);
        }
      } catch (streamError) {
        handleStreamError(streamError);
      }
    };

    stream();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [conversationId, promptText, submissionKey, updateStatus, dispatchStreamEvent]);

  if (!conversationId) {
    return null;
  }

  const showLoadingMessage =
    status === ConversationStreamStatus.Streaming && !hasReceivedStreamContentRef.current && !error;

  return (
    <>
      {/* this panel is only displayed if debug is true */}
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
