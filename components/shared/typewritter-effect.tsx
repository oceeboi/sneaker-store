'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypewriterProps {
  /** The text string to animate */
  text: string | number;
  /** Speed per token in seconds (default: 0.03) */
  speed?: number;
  /** Delay before the animation starts in seconds (default: 0) */
  delay?: number;
  /** Custom classes for tailoring text layout/styles */
  className?: string;
  /** Animate by 'character', whole 'word', or keep 'complete' as one block (default: 'character') */
  mode?: 'character' | 'word' | 'complete';
}

export function Typewriter({
  text,
  speed = 0.03,
  delay = 0,
  className,
  mode = 'character',
}: TypewriterProps) {
  const stringText = String(text);

  // Advanced Tokenizer safely matching characters, words, or the entire block
  let tokens: string[];
  if (mode === 'complete') {
    tokens = [stringText];
  } else if (mode === 'word') {
    tokens = stringText.split(' ');
  } else {
    tokens = stringText.split('');
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: speed,
        delayChildren: delay,
      },
    },
  };

  const tokenVariants: Variants = {
    hidden: { opacity: 0, display: 'none' },
    visible: {
      opacity: 1,
      display: 'inline-block',
    },
  };

  return (
    // Passing the text directly as a key forces a clean re-animation loop whenever your data updates
    <motion.span
      key={stringText}
      className={cn('inline-block tracking-normal', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {tokens.map((token, index) => (
        <motion.span
          key={`${token}-${index}`}
          variants={tokenVariants}
          className={cn(mode === 'word' && 'mr-[0.25em]')}
        >
          {token}
        </motion.span>
      ))}
    </motion.span>
  );
}
