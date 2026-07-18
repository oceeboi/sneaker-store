'use client';

/**
 * Accordion — reusable, accessible expand/collapse component.
 *
 * - Compound API: Accordion / Accordion.Item / Accordion.Trigger / Accordion.Content
 * - `type="single"` (one open at a time, optionally collapsible) or `type="multiple"`
 * - Trigger renders title + icon with `justify-between` — content on the left,
 *   chevron on the right, exactly like the sample layout.
 * - Smooth height animation with pure CSS (grid-template-rows 0fr -> 1fr trick),
 *   so it animates to "auto" height without measuring pixels in JS.
 * - Fully controlled or uncontrolled, keyboard accessible (aria-expanded,
 *   aria-controls, button semantics).
 *
 * Usage:
 *
 *   <Accordion type="single" collapsible defaultValue="shipping">
 *     <Accordion.Item value="shipping">
 *       <Accordion.Trigger>Shipping & returns</Accordion.Trigger>
 *       <Accordion.Content>
 *         <p>Free shipping on all orders over $150...</p>
 *       </Accordion.Content>
 *     </Accordion.Item>
 *
 *     <Accordion.Item value="sizing">
 *       <Accordion.Trigger>Size guide</Accordion.Trigger>
 *       <Accordion.Content>...</Accordion.Content>
 *     </Accordion.Item>
 *   </Accordion>
 */

import * as React from 'react';

// -----------------------------------------------------------------------------
// Root context
// -----------------------------------------------------------------------------

interface AccordionContextValue {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionContext(component: string): AccordionContextValue {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error(`<Accordion.${component}> must be rendered inside an <Accordion>.`);
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Item context (each item shares its own open state + a stable id for aria-*)
// -----------------------------------------------------------------------------

interface AccordionItemContextValue {
  value: string;
  open: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext(component: string): AccordionItemContextValue {
  const ctx = React.useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error(`<Accordion.${component}> must be rendered inside an <Accordion.Item>.`);
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Root
// -----------------------------------------------------------------------------

type SingleAccordionProps = {
  type?: 'single';
  /** If true, the open item can be closed again by clicking it. Default true. */
  collapsible?: boolean;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
};

type MultipleAccordionProps = {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

type AccordionProps = (SingleAccordionProps | MultipleAccordionProps) & {
  children: React.ReactNode;
  className?: string;
};

function Accordion(props: AccordionProps) {
  const { children, className = '' } = props;

  if (props.type === 'multiple') {
    return <MultipleAccordion {...props}>{children}</MultipleAccordion>;
  }
  return (
    <SingleAccordion {...(props as SingleAccordionProps & { children: React.ReactNode })}>
      {children}
    </SingleAccordion>
  );
}

function SingleAccordion({
  collapsible = true,
  value,
  defaultValue = null,
  onValueChange,
  children,
  className = '',
}: SingleAccordionProps & { children: React.ReactNode; className?: string }) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState<string | null>(defaultValue);
  const current = isControlled ? (value as string | null) : uncontrolled;

  const toggle = React.useCallback(
    (item: string) => {
      const next = current === item ? (collapsible ? null : current) : item;
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [current, collapsible, isControlled, onValueChange]
  );

  const ctx = React.useMemo<AccordionContextValue>(
    () => ({ isOpen: (item) => current === item, toggle }),
    [current, toggle]
  );

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

function MultipleAccordion({
  value,
  defaultValue = [],
  onValueChange,
  children,
  className = '',
}: MultipleAccordionProps & { children: React.ReactNode; className?: string }) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(defaultValue);
  const current = isControlled ? (value as string[]) : uncontrolled;

  const toggle = React.useCallback(
    (item: string) => {
      const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [current, isControlled, onValueChange]
  );

  const ctx = React.useMemo<AccordionContextValue>(
    () => ({ isOpen: (item) => current.includes(item), toggle }),
    [current, toggle]
  );

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Item
// -----------------------------------------------------------------------------

interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

function AccordionItem({ value, disabled = false, children, className = '' }: AccordionItemProps) {
  const { isOpen } = useAccordionContext('Item');
  const reactId = React.useId();

  const ctx = React.useMemo<AccordionItemContextValue>(
    () => ({
      value,
      open: isOpen(value),
      disabled,
      triggerId: `accordion-trigger-${reactId}`,
      contentId: `accordion-content-${reactId}`,
    }),
    [value, isOpen, disabled, reactId]
  );

  return (
    <AccordionItemContext.Provider value={ctx}>
      <div
        className={`border-b border-black/10 ${className}`}
        data-state={ctx.open ? 'open' : 'closed'}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Trigger — title + icon, space-between
// -----------------------------------------------------------------------------

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
  /** Custom icon; defaults to a chevron that rotates 180deg when open. */
  icon?: React.ReactNode;
}

function AccordionTrigger({ children, className = '', icon }: AccordionTriggerProps) {
  const { toggle } = useAccordionContext('Trigger');
  const { value, open, disabled, triggerId, contentId } = useAccordionItemContext('Trigger');

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      disabled={disabled}
      onClick={() => toggle(value)}
      className={`flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-white transition-colors hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base ${className}`}
    >
      <span>{children}</span>
      <span
        className="shrink-0 text-black transition-transform duration-300 ease-out"
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        {icon ?? <ChevronIcon />}
      </span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Content — animates open/closed via the grid-template-rows 0fr -> 1fr trick.
// This animates smoothly to the content's natural height without ever
// measuring pixels in JS, and works for dynamic/variable-height content.
// -----------------------------------------------------------------------------

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

function AccordionContent({ children, className = '' }: AccordionContentProps) {
  const { open, contentId, triggerId } = useAccordionItemContext('Content');

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">
        <div className={`pb-4 text-sm leading-6 text-white/60 ${className}`}>{children}</div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;

export { Accordion };
export type { AccordionProps, AccordionItemProps, AccordionTriggerProps, AccordionContentProps };
