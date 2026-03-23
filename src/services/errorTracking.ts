/**
 * Error tracking integration point.
 * Currently logs to console. Replace the implementation with Sentry, DataDog,
 * or another error tracking service for production observability.
 *
 * Usage:
 *   import { captureError } from './errorTracking';
 *   captureError(err, { component: 'TestPanel', action: 'streamCompletion' });
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  agentId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Capture and report an error with optional context metadata.
 * Integration point for Sentry / DataDog / custom error tracking.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Console logging — replace with Sentry.captureException / DD.addError in production
  console.error('[ErrorTracking]', {
    message,
    stack,
    ...context,
    timestamp: new Date().toISOString(),
  });

  // TODO: Replace with production error tracking, e.g.:
  // Sentry.captureException(error, { extra: context });
  // OR
  // datadogRum.addError(error, context);
}

/**
 * Capture a non-fatal warning/message (breadcrumb).
 */
export function captureMessage(message: string, context?: ErrorContext): void {
  console.warn('[ErrorTracking]', {
    message,
    ...context,
    timestamp: new Date().toISOString(),
  });
  // TODO: Sentry.captureMessage(message, { extra: context });
}
