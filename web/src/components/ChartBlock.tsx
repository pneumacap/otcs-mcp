"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

export interface ChartConfig {
  type: "bar" | "line" | "area" | "pie";
  title?: string;
  xKey: string;
  series: { dataKey: string; name?: string }[];
  data: Record<string, unknown>[];
}

export default function ChartBlock({ config }: { config: ChartConfig }) {
  const { type, title, xKey, series, data } = config;

  const gridStroke = "var(--chart-grid, #e5e7eb)";
  const axisStroke = "var(--chart-axis, #9ca3af)";

  const commonCartesianProps = {
    data,
    margin: { top: 8, right: 16, left: 0, bottom: 4 },
  };

  const renderCartesian = () => {
    switch (type) {
      case "bar":
        return (
          <BarChart {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey={xKey} stroke={axisStroke} tick={{ fontSize: 11 }} />
            <YAxis stroke={axisStroke} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--chart-tooltip-bg, #fff)", borderColor: "var(--chart-tooltip-border, #e5e7eb)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name || s.dataKey} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey={xKey} stroke={axisStroke} tick={{ fontSize: 11 }} />
            <YAxis stroke={axisStroke} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--chart-tooltip-bg, #fff)", borderColor: "var(--chart-tooltip-border, #e5e7eb)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name || s.dataKey} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey={xKey} stroke={axisStroke} tick={{ fontSize: 11 }} />
            <YAxis stroke={axisStroke} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--chart-tooltip-bg, #fff)", borderColor: "var(--chart-tooltip-border, #e5e7eb)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s, i) => (
              <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name || s.dataKey} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        );
      default:
        return null;
    }
  };

  if (type === "pie") {
    const dataKey = series[0]?.dataKey || "value";
    return (
      <div className="my-3 rounded-xl border border-[var(--chart-tooltip-border,#e5e7eb)] bg-[var(--chart-tooltip-bg,#fff)] p-4">
        {title && <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{title}</p>}
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey={dataKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} label={{ fontSize: 11 }}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--chart-tooltip-bg, #fff)", borderColor: "var(--chart-tooltip-border, #e5e7eb)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl border border-[var(--chart-tooltip-border,#e5e7eb)] bg-[var(--chart-tooltip-bg,#fff)] p-4">
      {title && <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{title}</p>}
      <ResponsiveContainer width="100%" height={280}>
        {renderCartesian()!}
      </ResponsiveContainer>
    </div>
  );
}
