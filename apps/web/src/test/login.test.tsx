import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth';
import { LoginPage } from '../pages/auth/LoginPage';

function json(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/student" element={<p>Student home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('shows the server error message on bad credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/auth/refresh')
          ? json(401, { code: 'NO_REFRESH_TOKEN', message: 'No refresh token', requestId: 'a' })
          : json(401, {
              code: 'INVALID_CREDENTIALS',
              message: 'Email or password is incorrect',
              requestId: 'b',
            }),
      ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'kid@test.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('sends a student to their home page after logging in', async () => {
    const user = {
      id: 'u1',
      email: 'kid@test.dev',
      displayName: 'Kid',
      role: 'student',
      disabled: false,
      createdAt: '',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/auth/refresh')
          ? json(401, { code: 'NO_REFRESH_TOKEN', message: 'x', requestId: 'a' })
          : json(200, { user, accessToken: 't', csrfToken: 'c' }),
      ),
    );
    renderLogin();
    await userEvent.click(await screen.findByRole('button', { name: 'Student' }));
    expect(await screen.findByText('Student home')).toBeInTheDocument();
  });
});
