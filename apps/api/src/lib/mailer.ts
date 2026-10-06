import { config } from '../config.js';
import { logger } from './logger.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Captured mail in tests, so reset-link flows can be exercised end to end. */
export const testOutbox: Mail[] = [];

// No mail provider is wired yet. In development the message is logged so the
// reset link can be copied; in production only the fact of sending is logged.
export async function sendMail(mail: Mail): Promise<void> {
  if (config.isTest) {
    testOutbox.push(mail);
    return;
  }
  if (config.isProd) {
    logger.info({ subject: mail.subject }, 'mail: no provider configured, message dropped');
    return;
  }
  logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'mail (dev console)');
}
