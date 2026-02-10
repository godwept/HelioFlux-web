import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
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

const LineChart = ({ data, series }) => {
  if (!data.length) {
    return <div className="chart-empty">No data available.</div>;
  }

  const chartData = data.map(entry => ({
    ...entry,
    time: entry.timestamp?.valueOf?.() ?? 0,
  }));

  return (
    <div className="chart">
      <div className="chart__container">
        <ResponsiveContainer width="100%" height={180}>
          <RechartsLineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<ChartTooltip />} />
            {series.map(seriesItem => (
              <Line
                key={seriesItem.key}
                type="monotone"
                dataKey={seriesItem.key}
                name={seriesItem.label}
                stroke={seriesItem.color}
                strokeWidth={2}
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
