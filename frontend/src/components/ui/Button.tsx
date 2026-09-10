import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-text-on-accent hover:bg-accent-strong shadow-[0_1px_0_0_rgba(0,0,0,0.15)]',
  secondary:
    'bg-transparent text-text-primary border border-border-default hover:border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] font-medium tracking-tight transition-colors duration-[var(--duration-fast)] cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
