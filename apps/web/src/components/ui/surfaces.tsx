import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: 'plain' | 'lavender' | 'mint' | 'peach';
};

export function Card({
  children,
  tone = 'plain',
  className = '',
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={`ui-card ui-card--${tone} ${className}`.trim()}
    >
      {children}
    </section>
  );
}

type AlertProps = {
  tone: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
  className?: string;
};

export function Alert({ tone, children, className = '' }: AlertProps) {
  return (
    <div
      className={`ui-alert ui-alert--${tone} ${className}`.trim()}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="ui-alert__mark" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <span className="ui-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="ui-empty">
      <span className="ui-empty__mark" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
