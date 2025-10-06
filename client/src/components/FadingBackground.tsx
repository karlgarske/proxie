import React, { useEffect, useRef, useState } from 'react';

type Props = {
  imageUrl?: string; // new background URL (can be empty to fade out)
  duration?: number; // ms (default 600)
  easing?: string; // any CSS timing function (default "ease")
  className?: string; // optional wrapper classes
  style?: React.CSSProperties; // optional wrapper styles (e.g., backgroundColor)
  children?: React.ReactNode; // content layered on top of the background
  onFadeEnd?: () => void; // callback after a fade completes
};

/**
 * Crossfades between background images by double-buffering two absolutely
 * positioned layers and toggling which layer is visible.
 */
export function FadingBackground({
  imageUrl = '',
  duration = 600,
  easing = 'ease',
  className,
  style,
  children,
  onFadeEnd,
}: Props) {
  // Two layers we flip between (A/B) so we can transition opacity.
  const [urlA, setUrlA] = useState<string>(imageUrl);
  const [urlB, setUrlB] = useState<string>('');
  const [showA, setShowA] = useState<boolean>(true); // which layer is on top/visible

  // Ref to prevent overlapping transitions from stepping on each other.
  const isTransitioningRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);

  // Initialize on mount with initial prop
  useEffect(() => {
    setUrlA(imageUrl || '');
    setShowA(true);
  }, []); // run once

  // When imageUrl changes, push it into the hidden layer, then flip visibility to crossfade.
  useEffect(() => {
    const nextUrl = imageUrl || '';
    const currentUrl = showA ? urlA : urlB;

    if (nextUrl === currentUrl) {
      pendingUrlRef.current = null;
      return;
    }

    if (isTransitioningRef.current) {
      pendingUrlRef.current = nextUrl;
      return;
    }

    pendingUrlRef.current = null;
    const setHiddenUrl = showA ? setUrlB : setUrlA;
    setHiddenUrl(nextUrl);

    // Ensure the browser paints the hidden layer with opacity 0 before we flip to 1.
    isTransitioningRef.current = true;
    requestAnimationFrame(() => {
      // Another frame helps avoid skipped transitions in some browsers.
      requestAnimationFrame(() => {
        setShowA((prev) => !prev);
      });
    });
  }, [imageUrl, showA, urlA, urlB]);

  // After the visible layer finishes its fade, clear the flag and notify.
  const handleTransitionEnd = () => {
    if (!isTransitioningRef.current) return;
    isTransitioningRef.current = false;
    onFadeEnd?.();

    const nextUrl = pendingUrlRef.current;
    if (nextUrl == null) return;

    pendingUrlRef.current = null;
    const setHiddenUrl = showA ? setUrlB : setUrlA;
    setHiddenUrl(nextUrl);

    isTransitioningRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowA((prev) => !prev);
      });
    });
  };

  const layerCommon: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transitionProperty: 'opacity',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: easing,
    // Let clicks go through to children if needed
    pointerEvents: 'none',
  };

  // Top-level wrapper hosts the stacked background layers + your content.
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      {/* Layer A */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          ...layerCommon,
          backgroundImage: urlA ? `url("${urlA}")` : undefined,
          opacity: showA && urlA ? 1 : 0,
        }}
      />
      {/* Layer B */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          ...layerCommon,
          backgroundImage: urlB ? `url("${urlB}")` : undefined,
          opacity: !showA && urlB ? 1 : 0,
        }}
      />

      {/* Your content sits above the backgrounds */}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
