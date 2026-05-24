import { cn } from '@/lib/utils';
import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#0a0a0a] shadow-sm placeholder:text-[#6b6b6b] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
