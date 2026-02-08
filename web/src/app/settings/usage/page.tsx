'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface BillingInfo {
  plan: string;
  status: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  periodEnd: string | null;
}

export default function UsagePage() {
  const { status } = useSession();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch('/api/billing/info');
        if (res.ok) {
          setBilling(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    if (status === 'authenticated') fetchBilling();
  }, [status]);

  if (status === 'loading' || loading) {
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

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const isFreeTier = billing?.plan === 'free';
  const isUnlimited = billing?.limit === null;
  const usagePercent =
    billing && billing.limit !== null && billing.limit > 0
      ? Math.min(100, (billing.used / billing.limit) * 100)
      : 0;

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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Usage</h1>
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
        {/* Current plan card */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Plan</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold capitalize text-gray-900 dark:text-white">
                  {billing ? capitalize(billing.plan) : 'Free'}
                </span>
                {billing?.status && billing.status !== 'active' && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {billing.status}
                  </span>
                )}
              </div>
            </div>
            {isFreeTier && (
              <Link
                href="/billing"
                className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
              >
                Upgrade
              </Link>
            )}
          </div>
          {billing?.periodEnd && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-600">
              Current period ends {new Date(billing.periodEnd).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Usage stats card */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Messages This Month
          </h2>

          {isUnlimited ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {billing?.used ?? 0}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">messages sent</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Your plan includes unlimited messages.
              </p>
            </div>
          ) : (
            <div>
              {/* Stats row */}
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Used</p>
                  <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white">
                    {billing?.used ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Remaining</p>
                  <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white">
                    {billing?.remaining ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Limit</p>
                  <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white">
                    {billing?.limit ?? 0}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{billing?.used ?? 0} used</span>
                  <span>{billing?.limit ?? 0} total</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent >= 90
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : usagePercent >= 70
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                          : 'bg-gradient-to-r from-[#1a6aff] to-[#00008b]'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                {usagePercent >= 90 && (
                  <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    You are approaching your monthly limit.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Upgrade CTA for free tier */}
        {isFreeTier && (
          <div className="rounded-xl border-2 border-[#1a6aff] bg-white p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Need more messages?
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Upgrade to Pro for unlimited messages, all 43 OTCS tools, and up to 25 connections.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/billing"
                className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
              >
                View Plans
              </Link>
              <Link
                href="/chat"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Continue with Free
              </Link>
            </div>
          </div>
        )}

        {/* Nav back to other settings */}
        <div className="mt-6 flex gap-4 text-sm">
          <Link
            href="/settings/profile"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Profile
          </Link>
          <Link
            href="/settings/connections"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Connections
          </Link>
          <Link
            href="/billing"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Billing
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
          Usage resets at the beginning of each calendar month.
        </p>
      </main>
    </div>
  );
}
