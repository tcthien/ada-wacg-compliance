'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth';

/**
 * Admin Login Page
 *
 * Provides authentication interface for admin users.
 * Handles form validation, error display, and successful login redirect.
 *
 * Requirements: 7.1 - Display login page if not authenticated
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAdminAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  /**
   * Validates email format
   */
  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    setEmailError('');
    return true;
  };

  /**
   * Validates password presence
   */
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }

    setPasswordError('');
    return true;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset errors
    setError('');
    setEmailError('');
    setPasswordError('');

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    try {
      await login(email, password);
      // Redirect to dashboard on success
      router.push('/admin/dashboard');
    } catch (err) {
      // Handle different error types
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      // Check for specific error types
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        setError('Too many login attempts. Please try again later.');
      } else if (errorMessage.includes('Invalid') || errorMessage.includes('credentials')) {
        setError('Invalid email or password.');
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        setError('Invalid email or password.');
      } else {
        setError(errorMessage || 'Login failed. Please try again.');
      }
    }
  };

  /**
   * Handles email field blur for validation
   */
  const handleEmailBlur = () => {
    if (email) {
      validateEmail(email);
    }
  };

  /**
   * Handles password field blur for validation
   */
  const handlePasswordBlur = () => {
    if (password) {
      validatePassword(password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-md px-4">
        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Admin Login
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access the admin dashboard
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span className="text-destructive text-xl" aria-hidden="true">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                disabled={isLoading}
                required
                aria-required="true"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                className={`
                  w-full px-4 py-3 rounded-lg border
                  bg-background text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                  ${emailError ? 'border-destructive' : 'border-input'}
                `}
                placeholder="admin@adashield.com"
                autoComplete="email"
              />
              {emailError && (
                <p
                  id="email-error"
                  className="mt-2 text-sm text-destructive"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                disabled={isLoading}
                required
                aria-required="true"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className={`
                  w-full px-4 py-3 rounded-lg border
                  bg-background text-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                  ${passwordError ? 'border-destructive' : 'border-input'}
                `}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {passwordError && (
                <p
                  id="password-error"
                  className="mt-2 text-sm text-destructive"
                  role="alert"
                >
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full px-6 py-3 rounded-lg font-medium
                bg-primary text-primary-foreground
                hover:bg-primary/90
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
                ${isLoading ? 'cursor-wait' : ''}
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>Signing in...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              This is a secure admin area. All login attempts are logged.
            </p>
          </div>
        </div>

        {/* Back to Main Site Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <span aria-hidden="true">←</span>
            <span>Back to ADAShield</span>
          </a>
        </div>
      </div>
    </div>
  );
}
