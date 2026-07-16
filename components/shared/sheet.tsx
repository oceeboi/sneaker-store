'use client';

/**
 * Sheet — a reusable, accessible slide-in panel.
 *
 * Design goals:
 * - Compound component API (Sheet / Sheet.Trigger / Sheet.Content / Sheet.Header / Sheet.Footer / Sheet.Close)
 *   so you control layout and content completely, the way you would with Radix or shadcn/ui.
 * - Controlled OR uncontrolled — pass `open` + `onOpenChange`, or just use `defaultOpen`.
 * - Portals into document.body so it always sits above app layout/z-index stacks.
 * - Real exit animation powered by framer-motion's AnimatePresence — unmounts only after
 *   the transition finishes, not instantly.
 * - Accessible: focus trap, focus restore, Escape to close, aria-modal, labelled by title.
 * - Body scroll lock while open.
 * - Drag-to-dismiss on the panel itself (touch + mouse) via framer-motion's native drag
 *   gesture — the panel tracks your pointer, snaps back if released early, or flicks/drags
 *   past the threshold to dismiss.
 *
 * Peer dependency: `framer-motion` (npm i framer-motion).
 *
 * Usage:
 *
 *   const [open, setOpen] = useState(false);
 *
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <Sheet.Trigger asChild>
 *       <button>Open</button>
 *     </Sheet.Trigger>
 *     <Sheet.Content side="right" size="md">
 *       <Sheet.Header>
 *         <Sheet.Title>Referral program</Sheet.Title>
 *         <Sheet.Description>Invite friends, earn rewards.</Sheet.Description>
 *       </Sheet.Header>
 *
 *       <div className="px-4 py-2">...your content...</div>
 *
 *       <Sheet.Footer>
 *         <Sheet.Close asChild>
 *           <button>Cancel</button>
 *         </Sheet.Close>
 *       </Sheet.Footer>
 *     </Sheet.Content>
 *   </Sheet>
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
  type Variants,
} from 'framer-motion';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(component: string): SheetContextValue {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error(`<Sheet.${component}> must be rendered inside a <Sheet>.`);
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Root
// -----------------------------------------------------------------------------

interface SheetProps {
  children: React.ReactNode;
  /** Controlled open state. Omit for uncontrolled usage with defaultOpen. */
  open?: boolean;
  /** Called whenever the sheet wants to open or close. */
  onOpenChange?: (open: boolean) => void;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
}

const ANIMATION_SECONDS = 0.3;

function Sheet({ children, open, onOpenChange, defaultOpen = false }: SheetProps) {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const actualOpen = isControlled ? (open as boolean) : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const reactId = React.useId();
  const titleId = `sheet-title-${reactId}`;
  const descriptionId = `sheet-description-${reactId}`;

  const value = React.useMemo<SheetContextValue>(
    () => ({ open: actualOpen, setOpen, titleId, descriptionId }),
    [actualOpen, setOpen, titleId, descriptionId]
  );

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

// -----------------------------------------------------------------------------
// Trigger
// -----------------------------------------------------------------------------

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render your own element instead of the default <button>, e.g. asChild + a styled component. */
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
}

function SheetTrigger({ asChild, children, onClick, ...props }: SheetTriggerProps) {
  const { setOpen } = useSheetContext('Trigger');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as any).props?.onClick?.(e);
        setOpen(true);
      },
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

type SheetSide = 'right' | 'left' | 'top' | 'bottom';
type SheetSize = 'sm' | 'md' | 'lg' | 'full';

interface SheetContentProps {
  children: React.ReactNode;
  side?: SheetSide;
  size?: SheetSize;
  className?: string;
  /** Disable click-outside-to-close. */
  disableOutsideClose?: boolean;
  /** Disable Escape-to-close. */
  disableEscapeClose?: boolean;
  /** Disable the drag-to-dismiss gesture. */
  disableDrag?: boolean;
  /** Hide the built-in close (×) button. */
  hideCloseButton?: boolean;
}

const SIDE_POSITION: Record<SheetSide, React.CSSProperties> = {
  right: { top: 0, right: 0, height: '100dvh' },
  left: { top: 0, left: 0, height: '100dvh' },
  top: { top: 0, left: 0, width: '100%' },
  bottom: { bottom: 0, left: 0, width: '100%' },
};

const SIZE_WIDTH: Record<SheetSize, string> = {
  sm: '320px',
  md: '420px',
  lg: '560px',
  full: '100%',
};

// Offscreen starting/ending position per side, expressed as x/y transforms
// that framer-motion animates to/from 0.
const HIDDEN_POSITION: Record<SheetSide, { x: string | number; y: string | number }> = {
  right: { x: '100%', y: 0 },
  left: { x: '-100%', y: 0 },
  top: { x: 0, y: '-100%' },
  bottom: { x: 0, y: '100%' },
};

// A very large bound in the "open" direction so drag is effectively free that
// way, while the "closed" direction is clamped to 0 — i.e. you can only ever
// drag the panel toward dismissal, never further onscreen.
const DRAG_CONSTRAINTS: Record<
  SheetSide,
  { left?: number; right?: number; top?: number; bottom?: number }
> = {
  right: { left: 0, right: 100000 },
  left: { left: -100000, right: 0 },
  top: { top: -100000, bottom: 0 },
  bottom: { top: 0, bottom: 100000 },
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

function SheetContent({
  children,
  side = 'right',
  size = 'md',
  className = '',
  disableOutsideClose = false,
  disableEscapeClose = false,
  disableDrag = false,
  hideCloseButton = false,
}: SheetContentProps) {
  const { open, setOpen, titleId, descriptionId } = useSheetContext('Content');

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);
  const isHorizontal = side === 'left' || side === 'right';
  const axisSign = side === 'right' || side === 'bottom' ? 1 : -1;
  const dragControls = useDragControls();

  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  // ---- Body scroll lock ----
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ---- Focus management: capture trigger focus, move focus in, restore on close ----
  React.useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      const raf = requestAnimationFrame(() => {
        const focusable = panelRef.current ? getFocusableElements(panelRef.current) : [];
        (focusable[0] ?? panelRef.current)?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else {
      lastFocusedRef.current?.focus?.();
    }
  }, [open]);

  // ---- Escape to close + focus trap ----
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !disableEscapeClose) {
        setOpen(false);
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, disableEscapeClose, setOpen]);

  // ---- Drag-to-dismiss ----
  // We use framer-motion's own drag gesture rather than tracking pointer
  // events by hand. `dragListener={false}` + `dragControls` lets us decide,
  // on pointer down, whether this press should start a drag at all (so
  // buttons/inputs inside the sheet stay clickable).
  const onPanelPointerDown = (e: React.PointerEvent) => {
    if (disableDrag) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;
    dragControls.start(e);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const rawOffset = isHorizontal ? info.offset.x : info.offset.y;
    const rawVelocity = isHorizontal ? info.velocity.x : info.velocity.y;
    // Normalize so "positive" always means "moving toward closed".
    const closingOffset = rawOffset * axisSign;
    const closingVelocity = rawVelocity * axisSign;

    const panelExtent = isHorizontal
      ? (panelRef.current?.offsetWidth ?? 1)
      : (panelRef.current?.offsetHeight ?? 1);
    const distanceThreshold = panelExtent * 0.3;
    const flickThreshold = 500;

    if (closingOffset > distanceThreshold || closingVelocity > flickThreshold) {
      setOpen(false);
    }
    // Otherwise `dragSnapToOrigin` below springs the panel back into place.
  };

  const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants: Variants = {
    hidden: HIDDEN_POSITION[side],
    visible: { x: 0, y: 0 },
  };

  if (!hasMounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet-root" aria-hidden={!open} className="fixed inset-0 z-100">
          {/* Backdrop */}
          <motion.div
            onClick={() => !disableOutsideClose && setOpen(false)}
            className="absolute inset-0 bg-black/50"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: ANIMATION_SECONDS, ease: 'easeOut' }}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            drag={disableDrag ? false : isHorizontal ? 'x' : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={DRAG_CONSTRAINTS[side]}
            dragElastic={0}
            dragMomentum={false}
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
            onPointerDown={onPanelPointerDown}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={panelVariants}
            transition={{ duration: ANIMATION_SECONDS, ease: [0.32, 0.72, 0, 1] }}
            className={`absolute flex flex-col bg-[#1e2124] text-white shadow-2xl outline-none ${className}`}
            style={{
              ...SIDE_POSITION[side],
              width: isHorizontal ? SIZE_WIDTH[size] : undefined,
              maxWidth: isHorizontal ? '100vw' : undefined,
              height: !isHorizontal ? SIZE_WIDTH[size] : undefined,
              maxHeight: !isHorizontal ? '100dvh' : undefined,
              touchAction: isHorizontal ? 'pan-y' : 'pan-x',
            }}
          >
            {!hideCloseButton && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-md p-1.5 text-black transition-colors cursor-pointer hover:bg-black/5 hover:text-black"
              >
                <CloseIcon />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// -----------------------------------------------------------------------------
// Layout helpers — purely presentational, opt-in
// -----------------------------------------------------------------------------

function SheetHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-6 pt-6 pb-4 ${className}`}>{children}</div>;
}

function SheetTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { titleId } = useSheetContext('Title');
  return (
    <h2 id={titleId} className={`text-lg font-semibold tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

function SheetDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { descriptionId } = useSheetContext('Description');
  return (
    <p id={descriptionId} className={`mt-1 text-sm text-white/60 ${className}`}>
      {children}
    </p>
  );
}

function SheetFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-auto flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

interface SheetCloseProps {
  asChild?: boolean;
  children: React.ReactElement | React.ReactNode;
}

function SheetClose({ asChild, children }: SheetCloseProps) {
  const { setOpen } = useSheetContext('Close');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as any).props?.onClick?.(e);
        setOpen(false);
      },
    });
  }

  return (
    <button type="button" onClick={() => setOpen(false)}>
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Exports — compound component
// -----------------------------------------------------------------------------

Sheet.Trigger = SheetTrigger;
Sheet.Content = SheetContent;
Sheet.Header = SheetHeader;
Sheet.Title = SheetTitle;
Sheet.Description = SheetDescription;
Sheet.Footer = SheetFooter;
Sheet.Close = SheetClose;

export { Sheet };
export type { SheetProps, SheetContentProps, SheetSide, SheetSize };
