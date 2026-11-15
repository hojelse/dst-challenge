"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** One series per chart, so one colour: the green of the logo. */
const SERIES = "#15803d";
const INK = "var(--muted-foreground)";

export type Bar = { label: string; value: number };

/**
 * A single-series bar chart. `horizontal` lays categories down the side,
 * which suits long labels such as Country names.
 */
export function BarChart({
  data,
  unit,
  horizontal = false,
  height,
}: {
  data: Bar[];
  /** What a bar counts, for the tooltip: "authors", "publications". */
  unit: string;
  horizontal?: boolean;
  height: number;
}) {
  const category = {
    dataKey: "label",
    type: "category" as const,
    tickLine: false,
    axisLine: false,
    tick: { fill: INK, fontSize: 12 },
    interval: 0,
  };
  const value = {
    type: "number" as const,
    tickLine: false,
    axisLine: false,
    tick: { fill: INK, fontSize: 12 },
    allowDecimals: false,
  };
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 16, right: horizontal ? 40 : 8, bottom: 0, left: 0 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            stroke="var(--border)"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis {...value} />
              <YAxis {...category} width={120} />
            </>
          ) : (
            <>
              <XAxis {...category} />
              <YAxis {...value} width={36} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(count) => [`${count} ${unit}`, ""]}
            separator=""
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="value"
            fill={SERIES}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position={horizontal ? "right" : "top"}
              fill="var(--foreground)"
              fontSize={11}
            />
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
