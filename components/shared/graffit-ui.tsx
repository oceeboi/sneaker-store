'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { STORE_DETAILS } from '@/constants/store-details';

export const SneakerGraffitiHeroArt: React.FC = () => {
  const details = STORE_DETAILS;
  return (
    <div className="relative flex items-center justify-center w-full max-w-md h-64 md:h-80 select-none overflow-visible">
      {/* Background Neon Spray Glow (Ambient) */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-56 h-56 bg-linear-to-tr from-fuchsia-600 via-pink-500 to-cyan-400 rounded-full blur-3xl opacity-50"
      />

      {/* SVG Container for Spray Splatters and Drips */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Paint Splatter Drops */}
        <motion.circle
          cx="80"
          cy="70"
          r="8"
          fill="#EC4899"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.circle
          cx="60"
          cy="90"
          r="4"
          fill="#EC4899"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        <motion.circle
          cx="330"
          cy="220"
          r="10"
          fill="#06B6D4"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6, delay: 0.4 }}
        />
        <motion.circle
          cx="350"
          cy="240"
          r="5"
          fill="#06B6D4"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.6, delay: 0.5 }}
        />

        {/* Paint Drips running down */}
        <motion.path
          d="M 120 180 Q 122 220 120 240 Q 118 245 122 245 Q 125 245 124 235 L 125 180 Z"
          fill="#F43F5E"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.8 }}
        />
        <motion.path
          d="M 280 175 Q 282 210 280 225 Q 278 230 282 230 Q 285 230 284 220 L 285 175 Z"
          fill="#A855F7"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        />
      </svg>

      {/* Layer 1: Backing Graffiti "FRESH" Text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
        animate={{ opacity: 1, scale: 1, rotate: -8 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="absolute top-4 left-6 text-6xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-yellow-400 via-pink-500 to-purple-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]"
        style={{ fontFamily: 'Impact, sans-serif' }}
      >
        FRESH!
      </motion.div>

      {/* Layer 2: Animated Floating High-Top Sneaker Silhouette */}
      <motion.div
        initial={{ y: 20, opacity: 0, rotate: -15 }}
        animate={{
          y: [-10, 10, -10],
          rotate: [-18, -12, -18],
          opacity: 1,
        }}
        transition={{
          y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          opacity: { duration: 0.5 },
        }}
        className="relative z-10 w-64 md:w-80 filter drop-shadow-[0_15px_15px_rgba(236,72,153,0.4)]"
      >
        <svg viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sneakerBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="soleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
          </defs>

          {/* Sneaker Main Body */}
          <path
            d="M 80 180 L 120 80 Q 140 60 190 70 L 280 100 Q 340 120 380 170 Q 420 180 450 200 L 450 230 L 70 230 Z"
            fill="url(#sneakerBody)"
            stroke="#000000"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* Sneaker Swoosh / Lightning Flame Stripe */}
          <path
            d="M 140 140 Q 220 120 310 165 Q 240 195 170 175 Z"
            fill="#FACC15"
            stroke="#000000"
            strokeWidth="5"
          />

          {/* Chunky Sole */}
          <path
            d="M 60 230 L 460 230 Q 470 230 465 245 L 450 260 L 70 260 L 55 245 Q 50 230 60 230 Z"
            fill="url(#soleGradient)"
            stroke="#000000"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* Sole Pattern / Ridges */}
          <path
            d="M 100 240 L 100 255 M 150 240 L 150 255 M 200 240 L 200 255 M 250 240 L 250 255 M 300 240 L 300 255 M 350 240 L 350 255 M 400 240 L 400 255"
            stroke="#000000"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Laces Detail */}
          <path
            d="M 160 95 L 200 115 M 180 85 L 220 105 M 200 75 L 240 95"
            stroke="#FFFFFF"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* Layer 3: Foreground Crown Tag with Hover Interaction */}
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
        className="absolute bottom-2 right-4 z-20 cursor-pointer bg-black/80 backdrop-blur-md border-2  px-4 py-1.5 rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center gap-2"
      >
        <span className="text-xl hidden">👑</span>
        <span className="text-xs whitespace-nowrap font-black tracking-widest  uppercase">
          {details.name}
        </span>
      </motion.div>
    </div>
  );
};
