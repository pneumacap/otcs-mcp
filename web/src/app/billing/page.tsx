'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface BillingInfo {
  plan: string;
  status: string;
  used: number;
  limit: number;
  remaining: number;
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    fetchBilling();
  }, []);

  useEffect(() => {
    if (success) setMessage('Subscription activated! Welcome to Pro.');
    if (canceled) setMessage('Checkout canceled.');
  }, [success, canceled]);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing/info');
      if (res.ok) {
        setBilling(await res.json());
      }
    } catch {
      /* ignore */
    }
  }

  async function handleUpgrade(plan: 'pro' | 'enterprise') {
    setLoading(true);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function handleManage() {
    setLoading(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  const isPro = billing?.plan === 'pro' || billing?.plan === 'enterprise';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white"
            >
              A
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Billing</h1>
          </div>
          <Link
            href="/chat"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Back to Chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Status message */}
        {message && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 text-sm ${
              success
                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* Current plan */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Plan</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
              {billing?.plan || 'Free'}
            </span>
            {billing?.status && billing.status !== 'active' && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                {billing.status}
              </span>
            )}
          </div>
          {billing && billing.limit !== Infinity && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Messages this month</span>
                <span>
                  {billing.used} / {billing.limit}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1a6aff] to-[#00008b] transition-all"
                  style={{ width: `${Math.min(100, (billing.used / billing.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {isPro && (
            <button
              onClick={handleManage}
              disabled={loading}
              className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Manage Subscription
            </button>
          )}
        </div>

        {/* Pricing cards */}
        {!isPro && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pro */}
            <div className="rounded-xl border-2 border-[#1a6aff] bg-white p-6 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pro</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                For teams that need unlimited access
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Unlimited messages</li>
                <li>All 43 OTCS tools</li>
                <li>25 OTCS connections</li>
                <li>Usage analytics</li>
                <li>Email support</li>
              </ul>
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
              >
                {loading ? 'Redirecting...' : 'Upgrade to Pro'}
              </button>
            </div>

            {/* Enterprise */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enterprise</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Custom solutions for large organizations
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>Everything in Pro</li>
                <li>Unlimited connections</li>
                <li>SSO / SAML</li>
                <li>Dedicated support + SLA</li>
                <li>Audit log export</li>
              </ul>
              <a
                href="mailto:sales@altius.ai"
                className="mt-6 block w-full rounded-lg border border-gray-200 py-2.5 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Contact Sales
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
