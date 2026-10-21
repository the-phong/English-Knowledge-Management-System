import Link from 'next/link';

export function FoundationHome() {
  return (
    <main className="page-shell">
      <div className="content">
        <p className="eyebrow">English Knowledge Management System</p>
        <h1>A place for deliberate English practice.</h1>
        <p className="intro">
          Your account and session security are ready. Learning features will be
          added in later phases.
        </p>
        <section aria-labelledby="foundation-heading" className="notice">
          <h2 id="foundation-heading">Get started</h2>
          <p>
            <Link href="/auth">Sign in or create an account</Link> to open your
            workspace.
          </p>
        </section>
      </div>
    </main>
  );
}
