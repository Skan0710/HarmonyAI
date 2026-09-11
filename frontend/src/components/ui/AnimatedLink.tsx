import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
}

/**
 * A text link whose underline slides in from the left on hover, with an
 * optional trailing arrow that fades and slides in alongside it.
 */
export const AnimatedLink: React.FC<AnimatedLinkProps> = ({
  children,
  className,
  showArrow = true,
  ...props
}) => {
  return (
    <Link
      className={cn(
        'group relative inline-flex items-center gap-1.5',
        "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:origin-right before:scale-x-0 before:bg-current before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] before:content-['']",
        'hover:before:origin-left hover:before:scale-x-100',
        className
      )}
      {...props}
    >
      {children}
      {showArrow && (
        <ArrowRight
          size={13}
          strokeWidth={1.75}
          className="-translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
        />
      )}
    </Link>
  );
};
