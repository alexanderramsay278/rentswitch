"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-triggered reveal, used across the landing page so sections arrive one at a time
 * instead of all appearing at once.
 *
 * Progressive enhancement by construction: with no className applied, a wrapped element is
 * just a normal, fully visible element. Only once this component mounts in the browser does
 * it opt into a "pending" (invisible) state and wait for IntersectionObserver before revealing.
 * A user with JavaScript disabled, or a search crawler, sees the full page immediately -
 * nothing on this site depends on motion to be legible.
 */
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  /** Either plain content, or a render function given `visible` for custom effects (e.g. a bar that grows on entry). */
  children: ReactNode | ((visible: boolean) => ReactNode);
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "pending" | "visible">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Every setState call below lives inside the observer's callback - a response to the
    // outside world changing, not a value we could have derived during render - so there is
    // nothing here for an effect-derived-state lint rule to object to.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion || entry.isIntersecting) {
          if (delayMs > 0 && !reduceMotion) {
            window.setTimeout(() => setState("visible"), delayMs);
          } else {
            setState("visible");
          }
          observer.disconnect();
        } else {
          setState("pending");
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs]);

  const revealClass =
    state === "pending" ? "rs-reveal-pending" : state === "visible" ? "rs-reveal-visible" : "";

  // "static" (no JS yet, or no JS ever) counts as visible for render-prop consumers like a
  // growing bar - a bar stuck at 0% forever is worse than one that just renders at full width
  // with no animation. Only the deliberate "pending" phase should read as not-yet-visible.
  const visible = state !== "pending";
  const content = typeof children === "function" ? children(visible) : children;

  return (
    <div ref={ref} className={`${className} ${revealClass}`.trim()}>
      {content}
    </div>
  );
}
