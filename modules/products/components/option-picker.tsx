'use client';

import { useMemo, useRef, useState } from 'react';

import { useOnClickOutside } from '@/hooks/use-on-click-outside';
import { cn } from '@/lib/utils';
import type { ProductOption } from '../types/admin-product.types';

type OptionPickerProps = {
  value: string | string[];
  options: ProductOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (nextValue: string | string[]) => void;
  multiple?: boolean;
  className?: string;
};

function normalizeToArray(value: string | string[]) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function OptionPicker({
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
  multiple = false,
  className,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside(panelRef, () => setOpen(false));

  const selectedValues = normalizeToArray(value);
  const selectedMap = useMemo(() => new Set(selectedValues), [selectedValues]);

  const visibleOptions = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return options;

    return options.filter((option) => {
      const target = `${option.label} ${option.description ?? ''}`.toLowerCase();
      return target.includes(trimmed);
    });
  }, [options, search]);

  const triggerText = useMemo(() => {
    if (selectedValues.length === 0) return placeholder;

    if (!multiple) {
      const first = options.find((option) => option.value === selectedValues[0]);
      return first?.label ?? placeholder;
    }

    if (selectedValues.length === 1) {
      const first = options.find((option) => option.value === selectedValues[0]);
      return first?.label ?? placeholder;
    }

    return `${selectedValues.length} selected`;
  }, [multiple, options, placeholder, selectedValues]);

  function selectSingle(next: string) {
    onChange(next);
    setOpen(false);
    setSearch('');
  }

  function toggleMulti(next: string) {
    const nextSet = new Set(selectedValues);

    if (nextSet.has(next)) {
      nextSet.delete(next);
    } else {
      nextSet.add(next);
    }

    onChange([...nextSet]);
  }

  return (
    <div ref={panelRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-900 outline-none transition-all',
          'focus:ring-2 focus:ring-black/30 focus:border-black',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-300'
        )}
      >
        <span className={selectedValues.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {triggerText}
        </span>
        <span aria-hidden="true" className="text-gray-500">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded border border-neutral-200 bg-white p-2 shadow-sm">
          <InputSearch value={search} onChange={setSearch} />

          <div className="mt-2 max-h-56 overflow-y-auto rounded border border-neutral-100">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-neutral-500">No options found.</p>
            ) : (
              visibleOptions.map((option) => {
                const selected = selectedMap.has(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      multiple ? toggleMulti(option.value) : selectSingle(option.value)
                    }
                    className={cn(
                      'flex w-full items-start gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50',
                      selected && 'bg-neutral-50'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                        selected
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-300 text-transparent'
                      )}
                    >
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-neutral-900">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="block truncate text-xs text-neutral-500">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InputSearch({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search options"
      className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-black/30 focus:border-black"
    />
  );
}
