// src/components/search-select.tsx
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface Option {
  label: string
  value: string
}

interface SearchSelectProps {
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  multiple?: boolean
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  disabled?: boolean
  className?: string
}

export function SearchSelect({
  options = [],
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  multiple = false,
  value,
  onChange,
  disabled = false,
  className,
}: SearchSelectProps) {
  const [open, setOpen] = React.useState(false)

  // Normalize value to array for easier internal handling
  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  const handleSelect = (currentValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(currentValue)
        ? selectedValues.filter((v) => v !== currentValue)
        : [...selectedValues, currentValue]
      onChange?.(newValues)
    } else {
      onChange?.(currentValue === value ? "" : currentValue)
      setOpen(false)
    }
  }

  const displayValue = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder
    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((val) => {
            const option = options.find((o) => o.value === val)
            return (
              <Badge variant="secondary" key={val} className="mr-1">
                {option?.label || val}
              </Badge>
            )
          })}
        </div>
      )
    }
    return options.find((option) => option.value === selectedValues[0])?.label || placeholder
  }, [selectedValues, options, multiple, placeholder])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between h-auto min-h-10", className)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}