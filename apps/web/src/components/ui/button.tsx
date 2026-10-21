import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      loading = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`ui-button ui-button--${variant} ${className}`.trim()}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        {children}
      </button>
    );
  },
);

export function linkButtonClass(variant: ButtonVariant = 'primary') {
  return `ui-button ui-button--${variant}`;
}
