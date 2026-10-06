import { ButtonLink } from '../components/ui';
import { Logo } from '../components/Layout';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
      <Logo />
      <div className="flex flex-1 flex-col justify-center">
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold">Nothing on this page.</h1>
        <p className="mt-3 max-w-md text-ink-2">
          The link may be old, or the page was moved. Your work is safe.
        </p>
        <ButtonLink to="/" className="mt-8 self-start">
          Go to your home page
        </ButtonLink>
      </div>
    </main>
  );
}
