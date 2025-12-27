/**
 * Sessions Module
 *
 * GDPR-compliant session management and anonymization.
 */

export {
  anonymizeSession,
  getSessionByToken,
  isSessionAnonymized,
  deleteSession,
  SessionServiceError,
  type AnonymizeSessionResult,
} from './session.service.js';

export { registerSessionRoutes } from './session.controller.js';
