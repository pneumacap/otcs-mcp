'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Connection {
  id: string;
  baseUrl: string;
  username: string;
  domain: string | null;
  tlsSkipVerify: boolean | null;
  createdAt: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Form state
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [tlsSkipVerify, setTlsSkipVerify] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    const res = await fetch('/api/connections');
    if (res.ok) setConnections(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl,
        username,
        password,
        domain: domain || undefined,
        tlsSkipVerify,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Failed to create connection');
      return;
    }

    setSuccess('Connection created and verified!');
    setShowForm(false);
    setBaseUrl('');
    setUsername('');
    setPassword('');
    setDomain('');
    setTlsSkipVerify(false);
    fetchConnections();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this connection?')) return;
    await fetch(`/api/connections?id=${id}`, { method: 'DELETE' });
    fetchConnections();
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-500 dark:focus:bg-gray-800';

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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              OTCS Connections
            </h1>
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
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Connection list */}
        {connections.length > 0 ? (
          <div className="mb-6 space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {conn.baseUrl}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {conn.username}
                    {conn.domain ? ` @ ${conn.domain}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(conn.id)}
                  className="rounded-lg px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No OTCS connections configured. Add one to start using AI-powered content management.
            </p>
          </div>
        )}

        {/* Add connection button / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            Add Connection
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              New OTCS Connection
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  Base URL
                </label>
                <input
                  type="url"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://your-server.com/otcs/cs.exe/api"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300">
                  Domain (optional)
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="CORP"
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={tlsSkipVerify}
                  onChange={(e) => setTlsSkipVerify(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Skip TLS verification (dev only — self-signed certs)
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
              >
                {loading ? 'Testing & Saving...' : 'Test & Save Connection'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError('');
                }}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
          Passwords are encrypted with AES-256-GCM before storage. Connections are tested on
          creation.
        </p>
      </main>
    </div>
  );
}
