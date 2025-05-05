import * as React from "react";
import {
  Area,
  XAxis,
  YAxis,
  AreaChart as RechartsAreaChart,
  BarChart as RechartsBarChart,
  Bar,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

type BarChartProps = React.HTMLAttributes<HTMLDivElement> & {
  data: any[];
  xAxisKey?: string;
  yAxisKey?: string;
  barKey: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  className?: string;
  tooltipFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
};

export function BarChart({
  data,
  xAxisKey = "name",
  barKey,
  color = "#4AAED9",
  height = 200,
  showGrid = false,
  showTooltip = true,
  showXAxis = true,
  showYAxis = false,
  className,
  tooltipFormatter,
  xAxisFormatter,
  ...props
}: BarChartProps) {
  return (
    <div className={cn("w-full h-full", className)} {...props}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          {showXAxis && (
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tick={{ fill: "#6B7280" }}
              tickFormatter={xAxisFormatter}
            />
          )}
          {showYAxis && <YAxis tick={false} axisLine={false} tickLine={false} />}
          {showTooltip && (
            <Tooltip
              formatter={(value) => 
                tooltipFormatter ? tooltipFormatter(value as number) : value
              }
              contentStyle={{
                backgroundColor: "white",
                border: "none",
                borderRadius: "0.5rem",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            />
          )}
          <Bar
            dataKey={barKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            activeBar={{ fill: `${color}CC` }}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

type AreaChartProps = React.HTMLAttributes<HTMLDivElement> & {
  data: any[];
  xAxisKey?: string;
  areaKey: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  className?: string;
  gradient?: boolean;
  tooltipFormatter?: (value: number) => string;
};

export function AreaChart({
  data,
  xAxisKey = "name",
  areaKey,
  color = "#4ADE80",
  height = 200,
  showGrid = false,
  showTooltip = true,
  showXAxis = true,
  showYAxis = false,
  className,
  gradient = true,
  tooltipFormatter,
  ...props
}: AreaChartProps) {
  const id = React.useId();
  
  return (
    <div className={cn("w-full h-full", className)} {...props}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={`colorGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          {showXAxis && (
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tick={{ fill: "#6B7280" }}
            />
          )}
          {showYAxis && <YAxis tick={false} axisLine={false} tickLine={false} />}
          {showTooltip && (
            <Tooltip
              formatter={(value) => 
                tooltipFormatter ? tooltipFormatter(value as number) : value
              }
              contentStyle={{
                backgroundColor: "white",
                border: "none",
                borderRadius: "0.5rem",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={areaKey}
            stroke={color}
            strokeWidth={2}
            fill={gradient ? `url(#colorGradient-${id})` : color}
            isAnimationActive={false}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Progress Circle Component
type ProgressCircleProps = React.HTMLAttributes<HTMLDivElement> & {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  value?: string | number;
};

export function ProgressCircle({
  percentage,
  size = 120,
  strokeWidth = 10,
  color = "#6366F1",
  label,
  value,
  className,
  ...props
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const dash = (percentage * circumference) / 100;

  return (
    <div className={cn("relative", className)} {...props}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {value && <div className="text-xl font-semibold">{value}</div>}
        {label && <div className="text-xs text-gray-500">{label}</div>}
      </div>
    </div>
  );
}
