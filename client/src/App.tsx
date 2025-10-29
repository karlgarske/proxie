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
import { type Tile, TiledItems } from './components/TiledItems';
import {
  ArrowRightIcon,
  GalleryVertical,
  GraduationCap,
  HeartIcon,
  SproutIcon,
  WrenchIcon,
} from 'lucide-react';
import { Label } from '@radix-ui/react-label';
import AnimatedContent from '@/components/AnimatedContent';

type PromptSubmission = {
  id: number;
  text: string;
};

type Suggestion = Tile & {
  icon?: any;
  text: string;
};

/* todo: static for initial prototype. will make dynamic if this is being used */
const suggestions: Suggestion[] = [
  { text: 'What are you working on now?', icon: <WrenchIcon /> },
  { text: 'What did you study in college?', icon: <GraduationCap /> },
  {
    text: 'What do you enjoy most about your work?',
    icon: <HeartIcon />,
  },
  { text: 'What do you do in your spare time?', icon: <SproutIcon /> },
];

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
  const [suggestion, setSuggestion] = useState<Suggestion>();
  const [suggestionIndex, setSuggestionIndex] = useState<number>(0);

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

  useEffect(() => {
    //delays display of controls to draw users eye
    const timeoutId = setTimeout(() => setControlsVisible(true), 1000);

    //rotates through suggestions
    const rotateId = setInterval(() => {
      setSuggestionIndex((prev) => prev + 1);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(rotateId);
    };
  }, []);

  useEffect(() => {
    const value = suggestions[suggestionIndex % suggestions.length];
    setSuggestion(value);
  }, [suggestionIndex]);

  useEffect(() => {
    promptInputRef.current?.focus();
  }, [controlsVisible]);

  useEffect(() => {
    if (bgInfo) {
      setBgOpacity(1);
      setControlsVisible(false);
    } else {
      setBgOpacity(0.35);
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
        setBg(`${backdrop}?t=${Date.now()}`); //cache buster
        setBgOpacity(0.35);
        setDescription(item?.description ?? '');
        setAttribution(item?.attribution ?? '');
      }
    } else {
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
  const bottom = submission
    ? 'bottom-8 pb-12 lg:bottom-32'
    : 'bottom-8 md:bottom-32 lg:bottom-64 pb-12';

  return (
    <>
      <div>
        <div className="grid grid-cols-6 gap-6 md:gap-12 mx-8 md:mx-32 xl:mx-48 my-8 min-h-[720px]">
          {/* backdrop, not in layout */}
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
          />

          {/* top-nav, not in layout */}
          <ul className="col-span-6 h-16 md:h-32 flex justify-end items-center text-base font-semibold">
            <li className="after:content-['|'] after:px-2 last:after:content-['']">
              <Link to="https://www.linkedin.com/in/karlgarske">LinkedIn</Link>
            </li>
            <li className="after:content-['|'] after:px-2 last:after:content-['']">
              <Link to="https://github.com/karlgarske">GitHub</Link>
            </li>
          </ul>

          {/* chat content */}
          <div
            id="chat"
            className={`col-span-6 lg:col-span-3 min-h-[400px] ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
          >
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

            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              {/* initial state when no prompt given */}
              {!submission &&
                "Greetings! I'm Karl, and I made this site so we can get to know each other better."}
              {/* display prompt */}
              {submission && submission.text}
            </h1>

            <div className="flex flex-col justify-start mb-[200px]">
              <ConversationStream
                conversationId={conversationId}
                promptText={submission?.text}
                submissionKey={submission?.id}
                debug={false}
                onEvent={handleConversationStreamEvent}
              />
              {conversationError && (
                <p className="text-sm text-red-600">
                  Error: {(conversationError as Error).message}
                </p>
              )}
              {/* show most relevant suggested topics if prompt classification yields results */}
              {!thinking &&
                !isClassifying &&
                classification &&
                classification.score > 0.25 &&
                classification.suggestions.length > 0 && (
                  <div className="flex gap-12 mt-16">
                    {classification.suggestions.map((suggestion, i) => (
                      <div
                        className="flex flex-col gap-4 font-semibold text-lg md:text-3xl cursor-pointer py-6"
                        key={i}
                        onClick={() => submit(suggestion)}
                      >
                        {suggestion}
                        <ArrowRightIcon />
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* backdrop info */}
          {!isClassifying && description != '' && (
            <div className="flex justify-center col-span-3 col-start-4 h-fit sticky lg:top-72 text-muted-foreground cursor-pointer">
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

          {/* floating input, not in grid layout */}
          <form
            onSubmit={handleSubmitPrompt}
            className={`sticky col-span-6 lg:col-span-3 lg:col-start-4 ${bottom} flex flex-col items-center justify-end gap-2 transition-all duration-400 ease-out ${controlsVisible ? `opacity-100 translate-y-0 ${submission ? '' : ''}` : 'opacity-0 translate-y-64'}`}
          >
            <div className="flex flex-nowrap gap-2">
              <input
                ref={promptInputRef}
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full rounded border-4 border-primary px-3 py-2 text-3xl focus:outline-none focus:border-primary focus:ring-4 bg-background"
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
            {/* show some animated suggestions to draw attentiona and get ideas flowing */}
            {!submission && (
              <div className="pl-2 pt-2 cursor-pointer" onClick={() => submit(suggestion!.text)}>
                <AnimatedContent
                  direction="horizontal"
                  distance={150}
                  invalidate={suggestion?.text}
                >
                  <div className="flex gap-2 flex-nowrap items-center font-semibold">
                    {suggestion?.icon}
                    {suggestion?.text}
                  </div>
                </AnimatedContent>
              </div>
            )}
          </form>
        </div>
      </div>
      {/* show some simple clickable jumping off points if user has scrolled here */}
      {!submission && (
        <div className="grid grid-cols-6">
          <TiledItems
            className="col-span-6 lg:col-span-5"
            items={suggestions}
            onSelect={(item: Tile) => submit(item.text)}
          />
        </div>
      )}
    </>
  );
}
