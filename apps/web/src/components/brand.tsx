import Link from 'next/link';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="EKMS home">
      <span className="brand__mark" aria-hidden="true">
        e
      </span>
      <span className="brand__name">
        ekms<span aria-hidden="true">.</span>
      </span>
    </Link>
  );
}
