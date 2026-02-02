export default function DemoPreview() {
  return (
    <section id="demo" className="section-alt px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[9px] font-bold text-white">
              OT
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              OTCS AI Assistant
            </span>
            <span className="ml-auto flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
          </div>

          {/* Chat area */}
          <div className="space-y-4 p-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md bg-[#1a6aff] px-4 py-2.5 text-[13.5px] text-white">
                Show me all contracts expiring in Q1 2026
              </div>
            </div>

            {/* Tool badge */}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <svg className="h-3 w-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                search documents
              </span>
            </div>

            {/* Assistant response with table */}
            <div className="space-y-3">
              <p className="text-[13.5px] text-gray-700 dark:text-gray-300">
                Found <strong className="font-semibold text-gray-900 dark:text-white">3 contracts</strong> expiring in Q1 2026:
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Document</th>
                      <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                      <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Acme Corp SLA</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Service Agreement</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Jan 31, 2026</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Wayne Ind. NDA</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Non-Disclosure</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Feb 15, 2026</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Globex Lease</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Lease Agreement</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Mar 10, 2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Faux input bar */}
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="flex-1 text-[13px] text-gray-400 dark:text-gray-600">
                Ask about your Content Server...
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a6aff] text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
