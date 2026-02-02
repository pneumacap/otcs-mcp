"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                            */
/* ------------------------------------------------------------------ */

function ToolBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
        <svg className="h-3 w-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-br-md bg-[#1a6aff] px-4 py-2.5 text-[13.5px] text-white">
        {text}
      </div>
    </div>
  );
}

function FauxInput() {
  return (
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
  );
}

/* ------------------------------------------------------------------ */
/*  Slide 1 — Document Search                                        */
/* ------------------------------------------------------------------ */

function SlideSearch() {
  return (
    <div className="space-y-4">
      <UserMessage text="Show me all contracts expiring in Q1 2026" />
      <ToolBadge label="Search Documents" />
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
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Acme Corp SLA</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Service Agreement</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Jan 31, 2026</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Wayne Ind. NDA</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Non-Disclosure</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Feb 15, 2026</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Globex Lease</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Lease Agreement</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Mar 10, 2026</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <FauxInput />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide 2 — Dashboard Visualization                                */
/* ------------------------------------------------------------------ */

function SlideCharts() {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const lines = [
    { label: "Enterprise",    color: "#4285F4", values: [82,88,95,92,98,100,103,108,112,118,125,135] },
    { label: "Professional",  color: "#34A853", values: [35,40,45,48,52,55,58,62,65,68,72,78] },
    { label: "Services",      color: "#EA4335", values: [28,30,32,35,38,40,42,48,50,52,55,50] },
    { label: "Starter",       color: "#FBBC05", values: [8,12,18,22,28,32,35,40,45,55,62,70] },
  ];
  const maxVal = 140;
  const chartW = 480;
  const chartH = 120;
  const padL = 40;
  const padR = 10;
  const padT = 5;
  const padB = 20;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  function toX(i: number) { return padL + (i / (months.length - 1)) * plotW; }
  function toY(v: number) { return padT + plotH - (v / maxVal) * plotH; }

  const yTicks = [0, 35000, 70000, 105000, 140000];

  return (
    <div className="space-y-4">
      <UserMessage text="Summarize demo_dashboard.csv using charts" />
      <ToolBadge label="Search Documents" />
      <ToolBadge label="Download Content" />
      <div className="space-y-3">
        <p className="text-[13.5px] text-gray-700 dark:text-gray-300">
          <strong className="font-semibold text-gray-900 dark:text-white">2025 SaaS Performance Dashboard:</strong>
        </p>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Monthly Revenue by Product Line ($)</p>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines & Y labels */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={padL} y1={toY(t / 1000)} x2={chartW - padR} y2={toY(t / 1000)} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={padL - 4} y={toY(t / 1000) + 1.5} textAnchor="end" className="fill-gray-400" style={{ fontSize: 6 }}>{(t / 1000).toLocaleString()}</text>
              </g>
            ))}
            {/* X labels */}
            {months.map((m, i) => (
              <text key={m} x={toX(i)} y={chartH - 4} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 6 }}>{m}</text>
            ))}
            {/* Lines */}
            {lines.map((line) => (
              <g key={line.label}>
                <polyline
                  fill="none"
                  stroke={line.color}
                  strokeWidth={1.5}
                  points={line.values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")}
                />
                {line.values.map((v, i) => (
                  <circle key={i} cx={toX(i)} cy={toY(v)} r={2} fill="white" stroke={line.color} strokeWidth={1} />
                ))}
              </g>
            ))}
          </svg>
          {/* Legend */}
          <div className="mt-2 flex justify-center gap-4">
            {lines.map((line) => (
              <div key={line.label} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
                <span className="text-[9px] text-gray-500">{line.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Metric</th>
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">2025 Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Total Revenue</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">$2,876,800</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Total Profit</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">$1,475,200 (51.3% margin)</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Top Revenue Line</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Enterprise ($1.25M, 44% share)</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Fastest Growing</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Starter (268% growth Jan→Dec)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <FauxInput />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide 3 — Workflow Tasks                                          */
/* ------------------------------------------------------------------ */

function SlideWorkflow() {
  return (
    <div className="space-y-4">
      <UserMessage text="Show my pending workflow tasks" />
      <ToolBadge label="Get Assignments" />
      <div className="space-y-3">
        <p className="text-[13.5px] text-gray-700 dark:text-gray-300">
          You have <strong className="font-semibold text-gray-900 dark:text-white">7 pending workflow tasks</strong>:
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Task</th>
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Priority</th>
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Workflow ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Review Document</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Medium</td><td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">OK</span></td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">178339</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Review Document</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Medium</td><td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">OK</span></td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">177804</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Pending Approval</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">High</td><td className="px-3 py-2"><span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Urgent</span></td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">179479</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Review Document</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Medium</td><td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">OK</span></td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">179669</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-gray-600 dark:text-gray-400">
          You have 5 &quot;Review Document&quot; and 2 &quot;Pending Approval&quot; tasks. Would you like details on any of these?
        </p>
      </div>
      <FauxInput />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide 4 — OCR / Document Extraction                              */
/* ------------------------------------------------------------------ */

function SlideExtraction() {
  return (
    <div className="space-y-4">
      <UserMessage text="Summarize the scanned loan deed" />
      <ToolBadge label="Search Documents" />
      <ToolBadge label="Download Content" />
      <ToolBadge label="OCR Extraction" />
      <div className="space-y-3">
        <p className="text-[13.5px] text-gray-700 dark:text-gray-300">
          Extracted and analyzed <strong className="font-semibold text-gray-900 dark:text-white">LN Deed - 500301</strong> (scanned TIFF, 3 MB):
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Field</th>
                <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Document Type</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Deed of Trust</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Grantor</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">George & Martha Washington</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Lien Amount</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">$150,000.00</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Property</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">1789 Plantation Rd, Mount Vernon, VA</td></tr>
              <tr><td className="px-3 py-2 text-gray-900 dark:text-gray-100">Trustee</td><td className="px-3 py-2 text-gray-600 dark:text-gray-400">Fidelity Trust Company</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-gray-600 dark:text-gray-400">
          This is a standard deed of trust securing a $150,000 loan against the residential property. The document contains 13 pages covering conveyance, environmental compliance, insurance, and default provisions.
        </p>
      </div>
      <FauxInput />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Carousel tabs                                                     */
/* ------------------------------------------------------------------ */

const slides = [
  { label: "Search", component: <SlideSearch /> },
  { label: "Analytics", component: <SlideCharts /> },
  { label: "Workflows", component: <SlideWorkflow /> },
  { label: "Extraction", component: <SlideExtraction /> },
];

export default function DemoPreview() {
  const [active, setActive] = useState(0);

  return (
    <section id="demo" className="section-alt px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Tab bar */}
        <div className="mb-4 flex justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.label}
              onClick={() => setActive(i)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                i === active
                  ? "bg-[#1a6aff] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {slide.label}
            </button>
          ))}
        </div>

        {/* Chat window */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-[9px] font-bold text-white">
              OT
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Altius
            </span>
            <span className="ml-auto flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
          </div>

          {/* Active slide */}
          <div className="p-6">
            {slides[active].component}
          </div>
        </div>
      </div>
    </section>
  );
}
