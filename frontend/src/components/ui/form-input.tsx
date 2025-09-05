import { forwardRef } from 'react'
import { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Label } from './label'

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  registration?: UseFormRegisterReturn
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, registration, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id} className={cn(error && 'text-destructive')}>
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          {...registration}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  }
)
