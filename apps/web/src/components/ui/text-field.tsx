import type { InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  id,
  label,
  hint,
  error,
  className = '',
  ...props
}: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        className="field__input"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
