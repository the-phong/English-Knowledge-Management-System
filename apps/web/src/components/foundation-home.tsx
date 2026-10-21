import Link from 'next/link';
import { Brand } from './brand';
import { AppContainer } from './ui/layout';
import { linkButtonClass } from './ui/button';

const plannedAreas = [
  {
    title: 'Vocabulary',
    description:
      'Collect words with the meaning and context that matter to you.',
  },
  {
    title: 'Practice',
    description: 'Build recognition and recall through focused study sessions.',
  },
  {
    title: 'Writing',
    description: 'Turn new vocabulary into confident, thoughtful sentences.',
  },
];

export function FoundationHome() {
  return (
    <>
      <AppContainer>
        <header className="public-header">
          <Brand />
          <span className="public-header__note">
            A focused space for English learning
          </span>
          <Link className={linkButtonClass('secondary')} href="/auth">
            Sign in
          </Link>
        </header>
        <main className="public-main">
          <section className="hero" aria-labelledby="home-title">
            <div className="hero__copy">
              <p className="eyebrow">English Knowledge Management System</p>
              <h1 id="home-title">
                Make room for <em>better learning.</em>
              </h1>
              <p className="hero__lead">
                EKMS is being built as a thoughtful home for the words you
                learn, the practice you do, and the progress you can understand.
                Your account workspace is available now. Learning features will
                be added in later phases.
              </p>
              <div className="hero__actions">
                <Link className={linkButtonClass()} href="/auth">
                  Sign in or create an account <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
            <div className="hero__aside" aria-label="EKMS product direction">
              <div className="hero__aside-top">
                <strong>One place to keep learning</strong>
                <span>Product direction</span>
              </div>
              <div className="hero__path">
                <div className="hero__path-item">
                  <span aria-hidden="true">01</span>
                  <div>
                    <strong>Start with your account</strong>
                    <small>Available now</small>
                  </div>
                </div>
                <div className="hero__path-item">
                  <span aria-hidden="true">02</span>
                  <div>
                    <strong>Grow a vocabulary library</strong>
                    <small>Planned for a later phase</small>
                  </div>
                </div>
                <div className="hero__path-item">
                  <span aria-hidden="true">03</span>
                  <div>
                    <strong>Practice and reflect</strong>
                    <small>Planned for a later phase</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="public-section" aria-labelledby="future-heading">
            <div>
              <p className="eyebrow">The direction</p>
              <h2 id="future-heading">A connected learning workspace.</h2>
            </div>
            <div className="public-section__grid">
              {plannedAreas.map((area) => (
                <article key={area.title}>
                  <span>Planned</span>
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
        <footer className="public-footer">
          <span>EKMS · English Knowledge Management System</span>
          <span>Built for deliberate practice.</span>
        </footer>
      </AppContainer>
    </>
  );
}
