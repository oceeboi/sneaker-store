import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate, useInView } from 'framer-motion';

interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number; // in seconds
  className?: string;
  formatter?: (value: number) => string;
}

export function AnimatedCounter({
  from = 0,
  to,
  duration = 1.5,
  className = '',
  formatter = (val) => Math.floor(val).toLocaleString(), // Default formatting: 1,000,000
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);

  // Motion value to track the raw animated number
  const count = useMotionValue(from);

  // Dynamically map the raw number using your formatter function
  const rounded = useTransform(count, (latest) => formatter(latest));

  // Trigger animation only when the element enters the viewport
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!isInView) return;

    // Framer Motion core animate engine
    const controls = animate(count, to, {
      duration: duration,
      ease: [0.16, 1, 0.3, 1], // Smooth custom ease-out curve
    });

    // Update the DOM text content directly for ultra-high performance
    const unsubscribe = rounded.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = latest;
      }
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [isInView, to, from, duration, count, rounded]);

  return (
    <span ref={ref} className={className}>
      {formatter(from)}
    </span>
  );
}
