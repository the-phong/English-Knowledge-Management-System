'use client';

import Link from 'next/link';
import { ProtectedShell } from '../../auth/protected-shell';
import { useAuth } from '../../auth/auth-context';
import { AppShell } from '../../components/app-shell';
import { linkButtonClass } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/layout';
import { Card } from '../../components/ui/surfaces';

function Workspace() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <AppShell current="app" userEmail={state.user.email}>
      <PageHeader
        eyebrow="Your workspace"
        title="Welcome back"
        description="A clear starting point for your English learning journey. Your account and session security are ready."
      />
      <div className="workspace-grid">
        <Card className="workspace-welcome">
          <p className="eyebrow">Available now</p>
          <h2>Your account, in one place.</h2>
          <p>Review your active sessions and manage how you stay signed in.</p>
          <Link className={linkButtonClass()} href="/account">
            Account and security <span aria-hidden="true">→</span>
          </Link>
        </Card>
        <Card tone="lavender" className="workspace-aside">
          <p className="eyebrow">Available now</p>
          <h2>Build your word library.</h2>
          <p>
            Save a word and the meaning you intend to learn. Source context is
            optional, and you can organize your entries with personal tags.
          </p>
          <Link className={linkButtonClass('secondary')} href="/vocabulary">
            Open Vocabulary <span aria-hidden="true">→</span>
          </Link>
        </Card>
      </div>
      <Card className="workspace-account" aria-label="Current account">
        <h2>Signed in as</h2>
        <dl>
          <dt>Email</dt>
          <dd>{state.user.email}</dd>
          <dt>Timezone</dt>
          <dd>{state.user.timezone}</dd>
        </dl>
      </Card>
    </AppShell>
  );
}

export default function AppPage() {
  return (
    <ProtectedShell>
      <Workspace />
    </ProtectedShell>
  );
}
