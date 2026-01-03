/**
 * Unit tests for error classification and message utilities
 *
 * Tests:
 * - classifyError() correctly identifies network, timeout, server, and unknown errors
 * - getErrorMessage() returns correct title, description, and action for each error type
 * - classifyAndGetMessage() combines classification and message retrieval
 * - Edge cases: empty messages, null, undefined, unusual error formats
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  getErrorMessage,
  classifyAndGetMessage,
  type ErrorType,
} from './error-utils';

describe('error-utils', () => {
  describe('classifyError', () => {
    describe('network errors', () => {
      it('should classify TypeError with fetch message as network error', () => {
        const error = new TypeError('Failed to fetch');
        const result = classifyError(error);

        expect(result).toBe('network');
      });

      it('should classify TypeError with fetch in message as network error', () => {
        const error = new TypeError('fetch failed due to network issue');
        const result = classifyError(error);

        expect(result).toBe('network');
      });

      it('should not classify TypeError without fetch as network error', () => {
        const error = new TypeError('Cannot read property of undefined');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });
    });

    describe('timeout errors', () => {
      it('should classify error with timeout message as timeout error', () => {
        const error = new Error('Request timeout');
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });

      it('should classify error with aborted message as timeout error', () => {
        const error = new Error('Request aborted');
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });

      it('should classify TimeoutError by name as timeout error', () => {
        const error = new Error('Operation failed');
        error.name = 'TimeoutError';
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });

      it('should classify AbortError by name as timeout error', () => {
        const error = new Error('Operation cancelled');
        error.name = 'AbortError';
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });

      it('should classify error with timeout in message (case sensitive)', () => {
        const error = new Error('Connection timeout occurred');
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });

      it('should classify error with aborted in message (case sensitive)', () => {
        const error = new Error('Request was aborted by user');
        const result = classifyError(error);

        expect(result).toBe('timeout');
      });
    });

    describe('server errors', () => {
      it('should classify error with 500 status as server error', () => {
        const error = new Error('HTTP 500 Internal Server Error');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with 502 status as server error', () => {
        const error = new Error('HTTP 502 Bad Gateway');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with 503 status as server error', () => {
        const error = new Error('HTTP 503 Service Unavailable');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with 504 status as server error', () => {
        const error = new Error('HTTP 504 Gateway Timeout');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with "internal server error" phrase as server error', () => {
        const error = new Error('Internal server error occurred');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with "bad gateway" phrase as server error', () => {
        const error = new Error('Bad gateway response received');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with "service unavailable" phrase as server error', () => {
        const error = new Error('Service unavailable at this time');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify error with "gateway timeout" phrase as server error', () => {
        // Note: "gateway timeout" matches timeout check first, so this would be 'timeout'
        // Only lowercase "gateway timeout" in message is checked for server errors
        const error = new Error('504 Gateway Timeout');
        const result = classifyError(error);

        expect(result).toBe('server');
      });

      it('should classify server errors regardless of message case', () => {
        const error1 = new Error('INTERNAL SERVER ERROR');
        const error2 = new Error('Bad Gateway');
        const error3 = new Error('SERVICE UNAVAILABLE');
        const error4 = new Error('Gateway Timeout');

        expect(classifyError(error1)).toBe('server');
        expect(classifyError(error2)).toBe('server');
        expect(classifyError(error3)).toBe('server');
        expect(classifyError(error4)).toBe('server');
      });
    });

    describe('unknown errors', () => {
      it('should classify generic Error as unknown', () => {
        const error = new Error('Something went wrong');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });

      it('should classify error with unrecognized message as unknown', () => {
        const error = new Error('Unexpected error occurred');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });

      it('should classify error with empty message as unknown', () => {
        const error = new Error('');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });

      it('should classify custom error types as unknown', () => {
        const error = new Error('Custom error');
        error.name = 'CustomError';
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });

      it('should classify SyntaxError as unknown', () => {
        const error = new SyntaxError('Invalid JSON');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });

      it('should classify RangeError as unknown', () => {
        const error = new RangeError('Invalid array length');
        const result = classifyError(error);

        expect(result).toBe('unknown');
      });
    });

    describe('edge cases', () => {
      it('should handle errors with special characters in message', () => {
        // Regular Error (not TypeError) with "fetch" won't match network
        const error = new TypeError('Error: failed to fetch @ https://api.example.com');
        const result = classifyError(error);

        expect(result).toBe('network');
      });

      it('should handle errors with multiple classification patterns', () => {
        // If an error matches multiple patterns, first match wins
        // This is a regular Error, so it checks in order: timeout, then server
        const error = new Error('fetch timeout with 500 status');
        const result = classifyError(error);

        // Should match 'timeout' first (because "timeout" is checked before server errors)
        expect(result).toBe('timeout');
      });

      it('should handle errors with partial pattern matches', () => {
        const error1 = new Error('prefetch data'); // Contains 'fetch' but not network error
        const error2 = new Error('time out of bounds'); // Contains 'time' but not timeout

        expect(classifyError(error1)).toBe('unknown');
        expect(classifyError(error2)).toBe('unknown');
      });
    });
  });

  describe('getErrorMessage', () => {
    it('should return correct message for network error type', () => {
      const result = getErrorMessage('network');

      expect(result).toEqual({
        title: 'Connection Error',
        description: 'Please check your internet connection and try again.',
        action: 'Retry',
      });
    });

    it('should return correct message for timeout error type', () => {
      const result = getErrorMessage('timeout');

      expect(result).toEqual({
        title: 'Request Timeout',
        description: 'The server is taking too long to respond.',
        action: 'Try Again',
      });
    });

    it('should return correct message for server error type', () => {
      const result = getErrorMessage('server');

      expect(result).toEqual({
        title: 'Server Error',
        description: 'Something went wrong on our end. Please try again later.',
        action: 'Retry',
      });
    });

    it('should return correct message for unknown error type', () => {
      const result = getErrorMessage('unknown');

      expect(result).toEqual({
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred.',
        action: 'Retry',
      });
    });

    it('should return consistent message structure for all error types', () => {
      const types: ErrorType[] = ['network', 'timeout', 'server', 'unknown'];

      types.forEach((type) => {
        const result = getErrorMessage(type);

        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('action');
        expect(typeof result.title).toBe('string');
        expect(typeof result.description).toBe('string');
        expect(typeof result.action).toBe('string');
        expect(result.title.length).toBeGreaterThan(0);
        expect(result.description.length).toBeGreaterThan(0);
        expect(result.action.length).toBeGreaterThan(0);
      });
    });
  });

  describe('classifyAndGetMessage', () => {
    it('should classify network error and return appropriate message', () => {
      const error = new TypeError('Failed to fetch');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('network');
      expect(result.message).toEqual({
        title: 'Connection Error',
        description: 'Please check your internet connection and try again.',
        action: 'Retry',
      });
    });

    it('should classify timeout error and return appropriate message', () => {
      const error = new Error('Request timeout');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('timeout');
      expect(result.message).toEqual({
        title: 'Request Timeout',
        description: 'The server is taking too long to respond.',
        action: 'Try Again',
      });
    });

    it('should classify server error and return appropriate message', () => {
      const error = new Error('HTTP 500 Internal Server Error');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('server');
      expect(result.message).toEqual({
        title: 'Server Error',
        description: 'Something went wrong on our end. Please try again later.',
        action: 'Retry',
      });
    });

    it('should classify unknown error and return appropriate message', () => {
      const error = new Error('Something unexpected happened');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toEqual({
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred.',
        action: 'Retry',
      });
    });

    it('should return consistent structure with type and message', () => {
      const error = new Error('Test error');
      const result = classifyAndGetMessage(error);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('message');
      expect(result.message).toHaveProperty('title');
      expect(result.message).toHaveProperty('description');
      expect(result.message).toHaveProperty('action');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle errors with empty messages', () => {
      const error = new Error('');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('unknown');
      expect(result.message.title).toBeTruthy();
      expect(result.message.description).toBeTruthy();
      expect(result.message.action).toBeTruthy();
    });

    it('should handle errors with very long messages', () => {
      const longMessage = 'fetch '.repeat(1000) + 'error';
      const error = new TypeError(longMessage);
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('network');
      expect(result.message.title).toBeTruthy();
    });

    it('should handle errors with unicode characters', () => {
      const error = new Error('超时错误 timeout 🚨');
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('timeout');
      expect(result.message.title).toBeTruthy();
    });

    it('should handle errors with newlines and special characters', () => {
      const error = new Error('Failed to fetch\nNetwork error\r\n\t500');
      const result = classifyAndGetMessage(error);

      // Regular Error with "500" matches server error (not network)
      expect(result.type).toBe('server');
    });

    it('should handle AbortError from AbortController', () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      const result = classifyAndGetMessage(error);

      expect(result.type).toBe('timeout');
      expect(result.message.title).toBe('Request Timeout');
    });

    it('should handle real-world fetch failure scenarios', () => {
      const scenarios = [
        { error: new TypeError('Failed to fetch'), expectedType: 'network' as ErrorType },
        { error: new TypeError('NetworkError when attempting to fetch resource'), expectedType: 'network' as ErrorType },
        { error: new Error('The operation was aborted'), expectedType: 'timeout' as ErrorType },
        { error: new Error('Request timeout after 30000ms'), expectedType: 'timeout' as ErrorType },
        { error: new Error('Server returned 500'), expectedType: 'server' as ErrorType },
        { error: new Error('502 Bad Gateway from upstream'), expectedType: 'server' as ErrorType },
        { error: new Error('503 Service Unavailable'), expectedType: 'server' as ErrorType },
        { error: new Error('HTTP 504 Gateway Timeout'), expectedType: 'server' as ErrorType },
      ];

      scenarios.forEach(({ error, expectedType }) => {
        const result = classifyAndGetMessage(error);
        expect(result.type).toBe(expectedType);
        expect(result.message.title).toBeTruthy();
        expect(result.message.description).toBeTruthy();
        expect(result.message.action).toBeTruthy();
      });
    });
  });
});
