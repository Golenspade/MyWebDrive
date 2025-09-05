import { forwardRef } from 'react'
import { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Label } from './label'

interface SelectOption {
  label: string
  value: string
}

interface FormSelectProps {
  label?: string
  error?: string
  placeholder?: string
  options: SelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  registration?: UseFormRegisterReturn
  className?: string
}

export const FormSelect = forwardRef<HTMLButtonElement, FormSelectProps>(
  ({ label, error, placeholder, options, value, onValueChange, className }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <Label className={cn(error && 'text-destructive')}>
            {label}
          </Label>
        )}
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            ref={ref}
            className={cn(
              error && 'border-destructive focus:ring-destructive',
              className
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  }
)
