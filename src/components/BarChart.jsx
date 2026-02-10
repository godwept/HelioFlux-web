import './Chart.css';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 120;
const PADDING = 16;

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

const BarChart = ({ data, colorForValue, maxValue = 9 }) => {
  const lastTimestamp = data.at(-1)?.timestamp;

  if (!data.length) {
    return <div className="chart-empty">No data available.</div>;
  }

  const barCount = data.length;
  const availableWidth = CHART_WIDTH - PADDING * 2;
  const barWidth = Math.max(4, availableWidth / barCount - 4);

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
      >
        {data.map((entry, index) => {
          const height =
            ((entry.kp || 0) / maxValue) * (CHART_HEIGHT - PADDING * 2);
          const x = PADDING + index * (barWidth + 4);
          const y = CHART_HEIGHT - PADDING - height;
          return (
            <rect
              key={entry.timestamp?.toISOString?.() ?? index}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx="3"
              fill={colorForValue(entry.kp)}
            />
          );
        })}
      </svg>
      <div className="chart__footer">
        <span>{formatTimestamp(lastTimestamp)}</span>
        <span>Time (UTC)</span>
      </div>
    </div>
  );
};

export default BarChart;
