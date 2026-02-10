import { useId } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './Chart.css';

const formatTimestamp = timestamp => {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  return `${date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  })} ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
};

const formatTooltipValue = value =>
  Number.isFinite(value) ? value.toFixed(1) : '0.0';

const shadeColor = (hex, amount) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }
  const num = parseInt(normalized, 16);
  const clamp = value => Math.max(0, Math.min(255, value));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{formatTimestamp(label)}</div>
      {payload.map(entry => (
        <div key={entry.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: entry.color }} />
          <span>{entry.name}:</span>
          <strong>{formatTooltipValue(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const LineChart = ({
  data,
  series,
  yScale = 'linear',
  yDomain,
  yTickFormatter,
  referenceLines = [],
}) => {
  if (!data.length) {
    return <div className="chart-empty">No data available.</div>;
  }

  const gradientPrefix = useId();

  const chartData = data.map(entry => ({
    ...entry,
    time: entry.timestamp?.valueOf?.() ?? 0,
  }));

  return (
    <div className="chart">
      <div className="chart__container">
        <ResponsiveContainer width="100%" height={180}>
          <RechartsLineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              {series.map(seriesItem => {
                const gradientId = `${gradientPrefix}-${seriesItem.key}`;
                return (
                  <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={shadeColor(seriesItem.color, -40)} />
                    <stop offset="100%" stopColor={shadeColor(seriesItem.color, 30)} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatTimestamp}
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              scale={yScale}
              domain={yDomain ?? ['auto', 'auto']}
              tickFormatter={yTickFormatter}
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDataOverflow={yScale === 'log'}
            />
            <Tooltip content={<ChartTooltip />} />
            {referenceLines.map(line => (
              <ReferenceLine
                key={line.label}
                y={line.value}
                stroke={line.color}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: line.label, position: 'right', fill: line.color, fontSize: 10 }}
              />
            ))}
            {series.map(seriesItem => (
              <Line
                key={seriesItem.key}
                type="monotone"
                dataKey={seriesItem.key}
                name={seriesItem.label}
                stroke={`url(#${gradientPrefix}-${seriesItem.key})`}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart__footer">
        <span>{formatTimestamp(chartData.at(-1)?.time)}</span>
        <span>Time (UTC)</span>
      </div>
    </div>
  );
};

export default LineChart;
