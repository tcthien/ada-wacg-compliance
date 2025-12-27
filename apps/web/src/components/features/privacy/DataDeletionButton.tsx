'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function DataDeletionButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get session token from cookie
      const sessionToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('session='))
        ?.split('=')[1];

      if (!sessionToken) {
        throw new Error('No session found');
      }

      await api.sessions.delete(sessionToken);
      setSuccess(true);

      // Clear local storage and cookies
      localStorage.clear();
      document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete data');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
        Your data has been successfully deleted. You can close this page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Delete all your scan history, results, and personal data from our servers.
        This action is irreversible.
      </p>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        onClick={handleDelete}
        disabled={loading}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Deleting...' : 'Delete My Data'}
      </button>
    </div>
  );
}
