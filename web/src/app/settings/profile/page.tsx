'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Seed the name field from the session once it loads
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  // Fetch org name
  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch('/api/billing/info');
        if (res.ok) {
          const data = await res.json();
          // The billing endpoint returns the plan; we can also try a profile endpoint.
          // For now, we display the plan context.
          setOrgName(data.plan ? `${capitalize(data.plan)} Plan` : null);
        }
      } catch {
        // ignore — org name is best-effort
      }
    }
    if (status === 'authenticated') fetchOrg();
  }, [status]);

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to update profile');
      } else {
        setMessage('Profile updated successfully.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-500 dark:focus:bg-gray-800';

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You must be signed in to view this page.
          </p>
          <Link
            href="/sign-in"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white"
            >
              A
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h1>
          </div>
          <Link
            href="/chat"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Back to Chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {message}
          </div>
        )}

        {/* Profile form */}
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Account Information
          </h2>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ''}
                readOnly
                className={`${inputClass} cursor-not-allowed opacity-60`}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
                Email cannot be changed.
              </p>
            </div>

            {/* Provider */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                Sign-in Method
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {user?.image ? 'Google' : 'Email / Password'}
                </span>
              </div>
            </div>

            {/* Organization */}
            {orgName && (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  Organization
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                    {orgName}
                  </span>
                  <Link
                    href="/billing"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Manage billing
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Settings nav */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Settings</h2>
          <nav className="space-y-1">
            <Link
              href="/settings/connections"
              className="flex items-center rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              OTCS Connections
            </Link>
            <Link
              href="/settings/usage"
              className="flex items-center rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Usage
            </Link>
            <Link
              href="/billing"
              className="flex items-center rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Billing
            </Link>
          </nav>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
          Altius by Altius AI. Your data is encrypted at rest.
        </p>
      </main>
    </div>
  );
}
