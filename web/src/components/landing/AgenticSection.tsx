export default function AgenticSection() {
  const steps = [
    {
      tool: "Search Documents",
      label: "Find all unsigned loan deeds from Q4",
    },
    {
      tool: "Download Content",
      label: "Extract text from scanned TIFF via OCR",
    },
    {
      tool: "Get Workflow Info",
      label: "Check approval history and comments",
    },
    {
      tool: "Start Workflow",
      label: "Route to compliance for final review",
    },
  ];

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left — copy */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Industry First
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Agentic AI that{" "}
              <span className="bg-gradient-to-r from-[#1a6aff] to-[#00008b] bg-clip-text text-transparent">
                actually operates
              </span>{" "}
              your OpenText Content Server
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              Other platforms bolt a chatbot onto search. We built an AI agent
              that reasons, plans, and executes multi-step content processes
              autonomously — chaining tool calls across your entire Content
              Server without human hand-holding.
            </p>
            <div className="mt-6 space-y-3">
              <Differentiator text="Autonomous multi-step execution — not just Q&A" />
              <Differentiator text="Chains searches, downloads, extractions, and actions in a single conversation" />
              <Differentiator text="Reads scanned documents, reasons over workflow history, then takes action" />
              <Differentiator text="No pre-built automations — the AI decides the optimal path in real time" />
            </div>
          </div>

          {/* Right — animated tool chain visualization */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 p-6 shadow-lg dark:border-gray-800 dark:from-gray-900 dark:to-gray-900/80">
            <p className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Agentic Tool Chain
            </p>
            <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
              &quot;Find unsigned loan deeds and route them for compliance review&quot;
            </p>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.tool} className="flex items-start gap-3">
                  {/* Vertical connector */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white shadow-sm">
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="h-8 w-px bg-gradient-to-b from-[#1a6aff]/40 to-[#1a6aff]/10" />
                    )}
                  </div>
                  {/* Step content */}
                  <div className="pt-1 pb-4">
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {step.tool}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                4 tools chained autonomously
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                The AI decided each step based on context — no workflow was pre-configured.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiator({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#1a6aff]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm text-gray-700 dark:text-gray-300">{text}</span>
    </div>
  );
}
