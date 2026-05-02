import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  resetOption?: SearchableSelectOption;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  contentClassName?: string;
  "data-testid"?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  resetOption,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No results",
  className,
  contentClassName,
  ...props
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const allOptions = React.useMemo(
    () => (resetOption ? [resetOption, ...options] : options),
    [resetOption, options],
  );

  const selected = allOptions.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
          data-testid={props["data-testid"]}
        >
          <span className="line-clamp-1 text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {resetOption && (
              <CommandGroup>
                <CommandItem
                  value="__reset__"
                  onSelect={() => {
                    onChange(resetOption.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === resetOption.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {resetOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="searchable-select-empty">
                {emptyText}
              </div>
            ) : (
              <CommandGroup>
                {filteredOptions.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
