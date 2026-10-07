import { ButtonLink } from '../components/ui';
import { Logo } from '../components/Layout';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
      <Logo />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-brand-600">404 error</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">Page not found</h1>
        <p className="mt-3 max-w-md text-gray-500">
          Sorry, we couldn’t find the page you’re looking for. It may have been moved or the link
          may be wrong.
        </p>
        <ButtonLink to="/" className="mt-8">
          Go to home
        </ButtonLink>
      </div>
    </main>
  );
}
