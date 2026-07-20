'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Unified item type specification handling basic strings or arbitrary objects safely
export type SearchableSelectItem = string | Record<string, any>;

export interface SearchableSelectProps {
  /** Array of collection elements mapping to either raw strings or structures */
  items?: SearchableSelectItem[];
  /** Standard input identification names for Form hooks layout engines */
  name?: string;
  /** Active input reference value (used for controlled implementations) */
  value?: string;
  /** Primary label displayed on top of input fields */
  label?: string;
  /** Placeholder descriptor copy inside string values query elements */
  placeholder?: string;
  /** Target lookup attribute field used to present key labels (default: 'name') */
  displayField?: string;
  /** Target payload identification attribute mapped for data collection actions (default: 'value') */
  valueField?: string;
  /** String collection arrays defining structural fields to lookup matches within (default: [displayField]) */
  searchFields?: string[];
  /** Native disabled boolean configuration values */
  disabled?: boolean;
  /** Append customized style attributes overrides across standard layers */
  className?: string;
  /** Toggle visibility profiles for inline clear cross icons (default: true) */
  clearable?: boolean;
  /** Restrict pixel configuration heights bounding select lists overlay options (default: 240) */
  maxHeight?: number;
  /** Structural selector filtering options logic properties (default: 'contains') */
  filterMode?: 'contains' | 'firstMatch';
  /** Callback utility matching standard hook handlers firing on state synchronization actions */
  onChange?: (value: string) => void;
  /** Auxiliary hook passing raw records alongside values directly to calling clients */
  onSelect?: (item: SearchableSelectItem | null, value: string) => void;
  /** Hook targets for binding validation references (React Hook Form register support) */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  xx?: boolean;
  hasError: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  items = [],
  name,
  value = '',
  label,
  placeholder = 'Search or select...',
  displayField = 'name',
  valueField = 'value',
  searchFields,
  disabled = false,
  className = '',
  clearable = true,
  maxHeight = 240,
  filterMode = 'contains',
  onChange,
  onSelect,
  onBlur,
  xx,
  hasError,
}) => {
  const componentId = useId();
  const actualSearchFields = searchFields || [displayField];

  // Helper function to extract fields cleanly from strings vs objects
  const getField = (item: SearchableSelectItem, field: string): string => {
    if (typeof item === 'object' && item !== null) {
      return String(item[field] ?? item[displayField] ?? '');
    }
    return String(item ?? '');
  };

  // Convert incoming controlled value to its corresponding display name text string string
  const getDisplayFromValue = (val: string): string => {
    if (!val) return '';
    const found = items.find((item) => getField(item, valueField) === val);
    return found ? getField(found, displayField) : val;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => getDisplayFromValue(value));
  const [selectedValue, setSelectedValue] = useState(value);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync state if initial value values shift dynamically externally
  useEffect(() => {
    setSelectedValue(value);
    setInputValue(getDisplayFromValue(value));
  }, [value, items]);

  // Compute filtering lists configurations
  const filteredItems = React.useMemo(() => {
    if (!isOpen && selectedValue && inputValue === getDisplayFromValue(selectedValue)) {
      return items;
    }
    if (!inputValue.trim()) return items;

    const query = inputValue.toLowerCase();
    if (filterMode === 'firstMatch') {
      const match = items.find((item) =>
        actualSearchFields.some((field) => getField(item, field).toLowerCase().includes(query))
      );
      return match ? [match] : [];
    }

    return items.filter((item) =>
      actualSearchFields.some((field) => getField(item, field).toLowerCase().includes(query))
    );
  }, [inputValue, items, actualSearchFields, filterMode, isOpen, selectedValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    setIsOpen(true);
    setFocusedIndex(-1);

    // If query is wiped empty clear field tracking metrics immediately
    if (!text.trim()) {
      setSelectedValue('');
      onChange?.('');
      onSelect?.(null, '');
    }
  };

  const handleItemSelect = (item: SearchableSelectItem) => {
    const displayVal = getField(item, displayField);
    const targetVal = getField(item, valueField);

    setInputValue(displayVal);
    setSelectedValue(targetVal);
    setIsOpen(false);
    setFocusedIndex(-1);

    onChange?.(targetVal);
    onSelect?.(item, targetVal);
    inputRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    setSelectedValue('');
    setIsOpen(false);
    setFocusedIndex(-1);
    onChange?.('');
    onSelect?.(null, '');
    inputRef.current?.focus();
  };

  // Click Away listeners triggers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
        // Reset textual label to reflect actual structural values if left unselected
        setInputValue(getDisplayFromValue(selectedValue));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0 && filteredItems[focusedIndex]) {
          handleItemSelect(filteredItems[focusedIndex]);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        setInputValue(getDisplayFromValue(selectedValue));
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'auto',
      });
    }
  }, [focusedIndex]);

  return (
    <div
      className={cn('w-full flex flex-col gap-1.5 text-left font-sans', className)}
      ref={dropdownRef}
    >
      {label && (
        <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label} {xx && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className={cn('relative w-full')}>
        {/* Native Hidden input channel synchronizing data context parameters to useForm standard mappings */}
        <input type="hidden" name={name} value={selectedValue} readOnly />

        <div className="relative flex items-center  w-full">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => !disabled && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded py-2.5 pl-3.5 pr-20 text-sm font-medium transition-colors outline-none focus:border-neutral-900 dark:focus:border-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50 dark:disabled:bg-neutral-950'
            )}
          />

          {/* Action Operations Tray */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-neutral-400 dark:text-neutral-500">
            {clearable && selectedValue && !disabled && (
              <button
                onClick={handleClear}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                type="button"
                tabIndex={-1}
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={() => !disabled && setIsOpen(!isOpen)}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
              type="button"
              tabIndex={-1}
              disabled={disabled}
            >
              <ChevronDown
                size={15}
                className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {/* Dropdown Options Lists Overlay overlay */}
        {isOpen && !disabled && (
          <div
            className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded shadow-lg overflow-y-auto"
            style={{ maxHeight }}
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const itemDisplay = getField(item, displayField);
                const itemValue = getField(item, valueField);
                const isSelected = selectedValue === itemValue;

                // Bulletproof dynamic compound safe string key configuration
                const itemKey = `${componentId}-item-${itemValue || itemDisplay}-${index}`;

                return (
                  <button
                    key={itemKey}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className={cn(
                      'w-full px-3.5 py-2 text-left text-sm font-medium transition-colors outline-none flex items-center justify-between border-b border-neutral-50 dark:border-neutral-950 last:border-0',
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 focus:bg-neutral-50 dark:focus:bg-neutral-800/50',
                      focusedIndex === index &&
                        'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                    )}
                  >
                    <span>{itemDisplay}</span>
                    {typeof item === 'object' && item?.category && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                        {item.category}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-neutral-400 dark:text-neutral-500 text-xs font-medium">
                No items found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
