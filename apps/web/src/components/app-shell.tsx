import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from './brand';
import { AppContainer } from './ui/layout';

type AppShellProps = {
  children: ReactNode;
  current: 'app' | 'vocabulary' | 'account';
  userEmail: string;
};

export function AppShell({ children, current, userEmail }: AppShellProps) {
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside className="workspace-shell__rail">
        <Brand href="/app" />
        <p className="workspace-shell__rail-label">Your workspace</p>
        <nav aria-label="Workspace" className="workspace-nav">
          <Link
            href="/app"
            aria-current={current === 'app' ? 'page' : undefined}
          >
            <span aria-hidden="true" className="workspace-nav__icon">
              ⌂
            </span>
            Home
          </Link>
          <Link
            href="/vocabulary"
            aria-current={current === 'vocabulary' ? 'page' : undefined}
          >
            <span aria-hidden="true" className="workspace-nav__icon">
              ◇
            </span>
            Vocabulary
          </Link>
          <Link
            href="/account"
            aria-label="Account and security"
            aria-current={current === 'account' ? 'page' : undefined}
          >
            <span aria-hidden="true" className="workspace-nav__icon">
              ◌
            </span>
            Account
          </Link>
        </nav>
        <div className="workspace-shell__rail-foot">
          <span className="avatar-mark" aria-hidden="true">
            {userEmail.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Signed in</strong>
            <span className="workspace-shell__email">{userEmail}</span>
          </div>
        </div>
      </aside>
      <div className="workspace-shell__body">
        <main id="workspace-main" className="workspace-shell__main">
          <AppContainer>{children}</AppContainer>
        </main>
        <footer className="workspace-shell__footer">
          <span>English Knowledge Management System</span>
          <span>Learning tools arrive in later phases.</span>
        </footer>
      </div>
    </div>
  );
}
