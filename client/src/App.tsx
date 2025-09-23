import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConversationStream } from '@/components/ConversationStream';
import { useConversations } from '@/hooks/useConversations';
import { CircleQuestionMarkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type PromptSubmission = {
  id: number;
  text: string;
};

export function App() {
  const {
    mutate: createConversation,
    data: conversation,
    isPending: isCreatingConversation,
    error: conversationError,
  } = useConversations();
  const [prompt, setPrompt] = useState('');
  const [submission, setSubmission] = useState<PromptSubmission | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [controlsVisible, setControlsVisible] = useState(false);
  const promptInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const timeoutId = setTimeout(() => setControlsVisible(true), 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    promptInputRef.current?.focus();
  }, [controlsVisible]);

  const handleSubmitPrompt = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isCreatingConversation) return;

    const promptText = prompt.trim();
    if (!promptText.length) return;

    setPrompt('');
    requestAnimationFrame(() => promptInputRef.current?.focus());

    const submissionPayload: PromptSubmission = { id: Date.now(), text: promptText };

    if (!conversationId) {
      createConversation(undefined, {
        onSuccess: (result) => {
          setConversationId(result.conversationId);
          setSubmission(submissionPayload);
        },
      });
      return;
    }

    setSubmission(submissionPayload);
  };

  //location of form input from bottom edge
  const bottom = submission ? 'bottom-16 md:bottom-32' : 'bottom-32 md:bottom-64';

  return (
    <div className="relative px-16 lg:px-32 py-24 space-y-4">
      <ul className="flex justify-end items-center text-sm absolute top-8 right-32">
        <li className="after:content-['|'] after:px-2 last:after:content-['']">
          <Link to="https://www.linkedin.com/in/karlgarske">LinkedIn</Link>
        </li>
        {/*<li className="after:content-['|'] after:px-2 last:after:content-['']">
          <Link to="https://github.com/karlgarske">GitHub</Link>
        </li>*/}
      </ul>
      <div className="font-semibold">Ask Me Anything</div>
      <form
        onSubmit={handleSubmitPrompt}
        className={`fixed ${bottom} p-2 rounded-md flex flex-nowrap gap-2 w-2/3 lg:right-32 lg:w-1/3 items-stretch transition-all duration-400 ease-out ${controlsVisible ? `opacity-100 translate-y-0 ${submission ? '' : 'bg-yellow-200'}` : 'opacity-0 translate-y-64'}`}
      >
        <input
          ref={promptInputRef}
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="flex-1 md:min-w-[300px] rounded border-2 border-primary px-3 py-2 text-3xl focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
          placeholder="Ask me anything"
        />
        <Button
          type="submit"
          disabled={!prompt.trim().length || isCreatingConversation}
          className="text-3xl h-full px-6"
        >
          Ask
        </Button>
      </form>
      {conversationError && (
        <p className="text-sm text-red-600">Error: {(conversationError as Error).message}</p>
      )}
      <div id="chat" className="max-w-[680px]">
        <h1 className="text-5xl md:text-6xl font-bold">
          Greetings! I'm Karl, and I made this site so we can get to know each other better.
        </h1>

        {submission && (
          <div className="flex gap-2 justify-start items-center w-fit bg-yellow-200 rounded-full p-4 mt-12 mb-6">
            <CircleQuestionMarkIcon strokeWidth="2.5" />
            <div className="text-xl">{submission?.text}</div>
          </div>
        )}

        <div className="flex justify-start mb-[400px]">
          <ConversationStream
            conversationId={conversationId}
            promptText={submission?.text}
            submissionKey={submission?.id}
            debug={false}
          />
        </div>
      </div>
    </div>
  );
}
