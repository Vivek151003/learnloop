import { z } from 'zod';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthResponse,
} from '@learnloop/shared';
import type { Response } from 'express';
import { ApiModule } from '../lib/route.js';
import { authLimiters } from '../middleware/rateLimit.js';
import * as auth from '../services/auth.js';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '../services/tokens.js';

export const authModule = new ApiModule('/auth', 'Auth');
const limited = [authLimiters.perIp, authLimiters.perAccount];

function respond(res: Response, s: auth.IssuedSession): AuthResponse {
  setSessionCookies(res, s.refreshToken, s.csrfToken);
  return { user: s.user, accessToken: s.accessToken, csrfToken: s.csrfToken };
}

const refreshCookie = (cookies: unknown) =>
  (cookies as Record<string, string | undefined>)[REFRESH_COOKIE];

authModule
  .route(
    {
      method: 'post',
      path: '/register',
      summary: 'Create an account',
      access: 'public',
      body: registerSchema,
      before: limited,
    },
    async ({ body, res }) => respond(res, await auth.register(body)),
  )
  .route(
    {
      method: 'post',
      path: '/login',
      summary: 'Log in with email and password',
      access: 'public',
      body: loginSchema,
      status: 200,
      before: limited,
    },
    async ({ body, req, res }) => respond(res, await auth.login(body, req.ip)),
  )
  .route(
    {
      method: 'post',
      path: '/refresh',
      summary: 'Rotate the refresh token and get a new access token',
      access: 'public',
      body: z.object({}).strict(),
      status: 200,
      before: [authLimiters.perIp],
    },
    async ({ req, res }) => {
      try {
        return respond(res, await auth.refresh(refreshCookie(req.cookies)));
      } catch (err) {
        clearSessionCookies(res);
        throw err;
      }
    },
  )
  .route(
    {
      method: 'post',
      path: '/logout',
      summary: 'Revoke the session',
      access: 'public',
      body: z.object({}).strict(),
      status: 204,
    },
    async ({ req, res }) => {
      await auth.logout(refreshCookie(req.cookies));
      clearSessionCookies(res);
    },
  )
  .route(
    {
      method: 'post',
      path: '/forgot-password',
      summary: 'Email a single-use reset link',
      access: 'public',
      body: forgotPasswordSchema,
      status: 202,
      before: limited,
    },
    async ({ body }) => {
      await auth.requestPasswordReset(body.email);
      return { message: 'If an account exists for that email, a reset link has been sent.' };
    },
  )
  .route(
    {
      method: 'post',
      path: '/reset-password',
      summary: 'Set a new password with a reset token',
      access: 'public',
      body: resetPasswordSchema,
      status: 204,
      before: [authLimiters.perIp],
    },
    async ({ body }) => {
      await auth.resetPassword(body.token, body.password);
    },
  );
