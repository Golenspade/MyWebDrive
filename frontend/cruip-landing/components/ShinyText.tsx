"use client";

import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

const ShinyText: React.FC<ShinyTextProps> = ({ text, disabled = false, speed = 5, className = '' }) => {
  const animationDuration = `${speed}s`;

  return (
    <>
      <div
        className={`text-transparent bg-clip-text inline-block ${className}`}
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(181,181,181,0.65) 0%, rgba(181,181,181,0.65) 40%, rgba(255,255,255,0.95) 50%, rgba(181,181,181,0.65) 60%, rgba(181,181,181,0.65) 100%)',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animationName: disabled ? 'none' : 'shine',
          animationDuration: animationDuration,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}
      >
        {text}
      </div>
      <style jsx global>{`
        @keyframes shine {
          0% { background-position: 200% 0%; }
          100% { background-position: -200% 0%; }
        }
      `}</style>
    </>
  );
};

export default ShinyText;

