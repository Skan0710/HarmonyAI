import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

const STAGGER = 0.035;

interface TextRollProps {
  children: string;
  className?: string;
  center?: boolean;
}

/** A single line of text that rolls up to reveal a duplicate copy on hover. */
export const TextRoll: React.FC<TextRollProps> = ({ children, className, center = false }) => {
  const characters = children.split('');

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn('relative inline-block overflow-hidden', className)}
      style={{ lineHeight: 1 }}
    >
      <div>
        {characters.map((char, i) => {
          const delay = center ? STAGGER * Math.abs(i - (characters.length - 1) / 2) : STAGGER * i;
          return (
            <motion.span
              key={i}
              variants={{ initial: { y: 0 }, hovered: { y: '-100%' } }}
              transition={{ ease: 'easeInOut', delay }}
              className="inline-block"
            >
              {char === ' ' ? ' ' : char}
            </motion.span>
          );
        })}
      </div>
      <div className="absolute inset-0">
        {characters.map((char, i) => {
          const delay = center ? STAGGER * Math.abs(i - (characters.length - 1) / 2) : STAGGER * i;
          return (
            <motion.span
              key={i}
              variants={{ initial: { y: '100%' }, hovered: { y: 0 } }}
              transition={{ ease: 'easeInOut', delay }}
              className="inline-block"
            >
              {char === ' ' ? ' ' : char}
            </motion.span>
          );
        })}
      </div>
    </motion.span>
  );
};
