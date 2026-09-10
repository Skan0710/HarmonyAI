import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

type IconButtonVariant = 'default' | 'active' | 'accent';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  'aria-label': string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
  active: 'text-accent bg-accent-wash',
  accent: 'bg-accent text-text-on-accent hover:bg-accent-strong',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 [&_svg]:w-3.5 [&_svg]:h-3.5',
  md: 'w-9 h-9 [&_svg]:w-4 [&_svg]:h-4',
  lg: 'w-11 h-11 [&_svg]:w-5 [&_svg]:h-5',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.12 }}
        className={`inline-flex items-center justify-center shrink-0 rounded-full transition-colors duration-[var(--duration-fast)] cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';
