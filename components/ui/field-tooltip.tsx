'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface FieldTooltipProps {
  text: string;
}

export function FieldTooltip({ text }: FieldTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex ml-1.5 align-middle text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors focus:outline-none">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
