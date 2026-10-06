import { ButtonLink } from '../components/ui';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-ink-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <ButtonLink to="/" className="mt-6">
        Go home
      </ButtonLink>
    </main>
  );
}
