import { redirect } from 'next/navigation';

/**
 * Admin Root Page
 *
 * This page redirects to the admin dashboard.
 *
 * Requirements:
 * - REQ 7.1: When an admin navigates to /admin, redirect to dashboard
 */
export default function AdminPage() {
  redirect('/admin/dashboard');
}
