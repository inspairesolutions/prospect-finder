import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /** Square icon-only button (dense rows, toolbars). Always set title for accessibility */
  icon?: boolean
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon = false,
      isLoading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const iconSizes = {
      sm: 'h-8 w-8 shrink-0 p-0 [&_svg]:h-4 [&_svg]:w-4',
      md: 'h-10 w-10 shrink-0 p-0 [&_svg]:h-[18px] [&_svg]:w-[18px]',
      lg: 'h-12 w-12 shrink-0 p-0 [&_svg]:h-5 [&_svg]:w-5',
    }

    const sizeClass = icon ? iconSizes[size] : sizes[size]

    return (
      <button
        ref={ref}
        className={cn('btn', variants[variant], sizeClass, icon && '!gap-0', className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className={cn(
              'animate-spin h-4 w-4',
              icon ? '' : '-ml-1 mr-2'
            )}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
