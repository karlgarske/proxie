import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConversationStream } from '@/components/ConversationStream';
import { useConversations } from '@/hooks/useConversations';
import { useHello } from '@/hooks/useHello';
import { Link } from 'react-router-dom';

const DEFAULT_PROMPT = 'Tell me a joke about coding.';

type PromptSubmission = {
  id: number;
  text: string;
};

export function App() {
  const { data, isLoading, error, refetch } = useHello();
  const {
    mutate: createConversation,
    data: conversation,
    isPending: isCreatingConversation,
    error: conversationError,
  } = useConversations();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [submission, setSubmission] = useState<PromptSubmission | null>(null);
  const [conversationId, setConversationId] = useState<string>();

  useEffect(() => {
    createConversation(undefined, {
      onSuccess: (result) => setConversationId(result.conversationId),
    });
  }, [createConversation]);

  useEffect(() => {
    if (conversation?.conversationId) {
      setConversationId(conversation.conversationId);
    }
  }, [conversation]);

  const handleSubmitPrompt = () => {
    if (isCreatingConversation) return;
    if (!conversationId) {
      createConversation(undefined, {
        onSuccess: (result) => {
          setConversationId(result.conversationId);
          setSubmission({ id: Date.now(), text: prompt });
        },
      });
      return;
    }

    setSubmission({ id: Date.now(), text: prompt });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Simple Web App</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <Link to="/hello" className="underline">
          Go to /hello
        </Link>
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="flex-1 min-w-[12rem] rounded border px-2 py-1 text-sm"
          placeholder="Enter a prompt"
        />
        <Button onClick={() => refetch()}>Fetch /api/hello</Button>
        <Button
          onClick={handleSubmitPrompt}
          disabled={!prompt.trim().length || isCreatingConversation}
        >
          Submit Prompt
        </Button>
      </div>
      <div className="p-4 rounded-md border">
        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">Error: {(error as Error).message}</p>}
        {data && (
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
      {conversationError && (
        <p className="text-sm text-red-600">Error: {(conversationError as Error).message}</p>
      )}
      <ConversationStream
        conversationId={conversationId}
        promptText={submission?.text}
        submissionKey={submission?.id}
      />
    </div>
  );
}
