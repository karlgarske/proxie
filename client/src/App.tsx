import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConversationStream } from '@/components/ConversationStream';
import type { ConversationStreamEvent } from '@/components/ConversationStream';
import { useClassify } from '@/hooks/useClassify';
import { useConversations } from '@/hooks/useConversations';
import { Link } from 'react-router-dom';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useTheme } from '@/components/theme-provider';
import { FadingBackground } from './components/FadingBackground';
import { FlameIcon, GalleryVertical, GraduationCap, Lightbulb, WrenchIcon } from 'lucide-react';
import { Label } from '@radix-ui/react-label';
import AnimatedContent from '@/components/AnimatedContent';

type PromptSubmission = {
  id: number;
  text: string;
};

type Idea = {
  icon: any;
  text: string;
};

export function App() {
  const { setTheme } = useTheme();
  setTheme('system');
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
  const [thinking, setThinking] = useState<boolean>(false);
  const { data: classification, isFetching: isClassifying } = useClassify(submission?.text ?? '');
  const [bg, setBg] = useState('');
  const [description, setDescription] = useState('');
  const [_, setAttribution] = useState('');
  const [bgOpacity, setBgOpacity] = useState(0);
  const [bgInfo, setBgInfo] = useState(false);
  const [idea, setIdea] = useState<Idea>();
  const [ideaIndex, setIdeaIndex] = useState<number>(0);

  const handleConversationStreamEvent = useCallback(
    (event: ConversationStreamEvent) => {
      if (event.type === 'status' && event.status === 'finished') {
        setThinking(false);
      } else if (event.type == 'status' && event.status == 'connecting') {
        setThinking(true);
      }

      if (event.type === 'error') {
        console.error('Conversation stream error:', event.error);
      }
    },
    [promptInputRef]
  );

  useEffect(() => {
    if (!thinking) promptInputRef.current?.focus();
  }, [thinking]);

  useEffect(() => {
    //uses hook to create a conversation via api
    createConversation(undefined, {
      onSuccess: (result) => setConversationId(result.conversationId),
    });
  }, [createConversation]);

  useEffect(() => {
    //waits for initial conversation to be created in the background
    if (conversation?.conversationId) {
      setConversationId(conversation.conversationId);
    }
  }, [conversation]);

  const ideas = [
    { icon: <GraduationCap />, text: 'Where did you go to school?' },
    { icon: <WrenchIcon />, text: 'What are you working on now?' },
    { icon: <FlameIcon />, text: 'How would you describe yourself?' },
  ];

  useEffect(() => {
    //delays display of controls to draw users eye
    const timeoutId = setTimeout(() => setControlsVisible(true), 1000);

    //rotates an idea to ask about
    const rotateId = setInterval(() => {
      setIdeaIndex((prev) => prev + 1);
    }, 5000);

    return () => {
      clearTimeout(timeoutId); //
      clearInterval(rotateId); //idea rotation
    };
  }, []);

  useEffect(() => {
    const idea = ideas[ideaIndex % ideas.length];
    setIdea(idea);
  }, [ideaIndex]);

  useEffect(() => {
    const idea = ideas[ideaIndex % ideas.length];
    setIdea(idea);
  }, [ideaIndex]);

  useEffect(() => {
    promptInputRef.current?.focus();
  }, [controlsVisible]);

  useEffect(() => {
    if (bgInfo) {
      setBgOpacity(1);
      setControlsVisible(false);
    } else {
      setBgOpacity(0.45);
      setControlsVisible(true);
    }
  }, [bgInfo]);

  useEffect(() => {
    if (classification && classification.score > 0.25) {
      console.log('classification:', classification);

      const length = classification?.backdrops.length ?? 0;
      if (length) {
        const randomIndex = Math.floor(Math.random() * length);
        const item = classification.backdrops[randomIndex];
        const backdrop = item?.url ?? '';
        //console.log('selected backdrop:', backdrop);
        setBg(`${backdrop}?t=${Date.now()}`); //cache buster
        setBgOpacity(0.45);
        setDescription(item?.description ?? '');
        setAttribution(item?.attribution ?? '');
      }
    } else {
      //console.log('selected backdrop:');
      setBg('');
      setDescription('');
      setAttribution('');
      setBgOpacity(0);
    }
  }, [classification]);

  const handleSubmitPrompt = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isCreatingConversation) return;

    const promptText = prompt.trim();
    if (!promptText.length) return;
    submit(promptText);
  };

  const submit = (text: string) => {
    setPrompt('');
    setBgOpacity(0);
    requestAnimationFrame(() => promptInputRef.current?.focus());

    const submissionPayload: PromptSubmission = { id: Date.now(), text };

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
  const bottom = submission ? 'bottom-8 md:bottom-32' : 'bottom-32 md:bottom-64';

  return (
    <>
      <FadingBackground
        imageUrl={bg} // string URL (changes trigger crossfade)
        duration={400} // ms
        easing="cubic-bezier(.2,.8,.2,1)" // any CSS timing function
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: '-10',
          opacity: bgOpacity,
        }} // shows through during fades/empty
      ></FadingBackground>

      <div className="relative px-8 md:px-16 lg:px-32 py-32 space-y-4 font-semibold">
        <ul className="flex justify-end items-center text-sm absolute top-16 right-8 lg:right-32">
          <li className="after:content-['|'] after:px-2 last:after:content-['']">
            <Link to="https://www.linkedin.com/in/karlgarske">LinkedIn</Link>
          </li>
          <li className="after:content-['|'] after:px-2 last:after:content-['']">
            <Link to="https://github.com/karlgarske">GitHub</Link>
          </li>
        </ul>
        <div className={`font-semibold ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
          Meet Karl's{' '}
          <Label
            className="underline cursor-pointer"
            onClick={() => {
              submit('What is Proxie?');
            }}
          >
            Proxie
          </Label>
        </div>
        <form
          onSubmit={handleSubmitPrompt}
          className={`fixed ${bottom} left-8 right-8 md:left-auto md:p-2 flex flex-col gap-2 md:w-2/3 lg:right-32 lg:w-1/3 transition-all duration-400 ease-out ${controlsVisible ? `opacity-100 translate-y-0 ${submission ? '' : ''}` : 'opacity-0 translate-y-64'}`}
        >
          <div className="flex flex-nowrap gap-2 items-stretch">
            <input
              ref={promptInputRef}
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="flex-1 min-w-0 md:min-w-[300px] rounded border-4 border-primary px-3 py-2 text-3xl focus:outline-none focus:border-primary focus:ring-4 bg-background"
              placeholder="Ask about Karl..."
              inputMode="text"
              enterKeyHint="send"
              disabled={thinking || isCreatingConversation}
            />
            <Button
              type="submit"
              disabled={!prompt.trim().length || isCreatingConversation}
              className="text-3xl h-auto px-6 hidden md:block"
            >
              Ask
            </Button>
          </div>
          {!submission && (
            <div className="pl-2 pt-2 cursor-pointer" onClick={() => submit(idea!.text)}>
              <AnimatedContent direction="horizontal" distance={150}>
                <div className="flex gap-2 flex-nowrap items-center">
                  {idea?.icon}
                  {idea?.text}
                </div>
              </AnimatedContent>
            </div>
          )}
          <div className="flex flex-nowrap gap-2 items-stretch">
            <input
              ref={promptInputRef}
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="flex-1 min-w-0 md:min-w-[300px] rounded border-4 border-primary px-3 py-2 text-3xl focus:outline-none focus:border-primary focus:ring-4 bg-background"
              placeholder="Ask about Karl..."
              inputMode="text"
              enterKeyHint="send"
              disabled={thinking || isCreatingConversation}
            />
            <Button
              type="submit"
              disabled={!prompt.trim().length || isCreatingConversation}
              className="text-3xl h-auto px-6 hidden md:block"
            >
              Ask
            </Button>
          </div>
          {!submission && (
            <div className="pl-2 pt-2 cursor-pointer" onClick={() => submit(idea!.text)}>
              <AnimatedContent direction="horizontal" distance={150}>
                <div className="flex gap-2 flex-nowrap items-center">
                  {idea?.icon}
                  {idea?.text}
                </div>
              </AnimatedContent>
            </div>
          )}
        </form>

        {!isClassifying && description != '' && (
          <div className="fixed right-8 lg:right-32 bottom-12 md:bottom-8 lg:top-64 text-muted-foreground cursor-pointer">
            <HoverCard
              openDelay={100}
              closeDelay={100}
              onOpenChange={(open: boolean) => {
                open ? setBgInfo(true) : setBgInfo(false);
              }}
            >
              <HoverCardTrigger className="flex items-center gap-2 text-primary font-semibold text-xl pr-8 w-fit">
                <GalleryVertical />
                <div className="hidden lg:block">About the background</div>
                <div className="lg:hidden">Background</div>
              </HoverCardTrigger>
              <HoverCardContent
                side="top"
                sideOffset={32}
                className="text-2xl w-[400px] bg-background/25"
              >
                {description}
              </HoverCardContent>
            </HoverCard>
          </div>
        )}

        <div id="chat" className={`max-w-[680px] ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {!submission &&
              "Greetings! I'm Karl, and I made this site so we can get to know each other better."}
            {submission && submission.text}
          </h1>

          <div className="flex flex-col justify-start mb-[400px]">
            <ConversationStream
              conversationId={conversationId}
              promptText={submission?.text}
              submissionKey={submission?.id}
              debug={false}
              onEvent={handleConversationStreamEvent}
            />
            {conversationError && (
              <p className="text-sm text-red-600">Error: {(conversationError as Error).message}</p>
            )}
            {!thinking &&
              !isClassifying &&
              classification &&
              classification.score > 0.25 &&
              classification.suggestions.length > 0 && (
                <div className="mt-12">
                  <div className="text-2xl flex gap-2 items-center">
                    <Lightbulb />
                    Suggestions
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 mt-4">
                    {classification.suggestions.map((suggestion, i) => (
                      <div
                        className="font-mono font-medium text-base md:text-lg w-2/3 md:w-1/2 pr-16 cursor-pointer"
                        key={i}
                        onClick={() => submit(suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
}
