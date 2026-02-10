import './Chart.css';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 120;
const PADDING = 16;

const buildLinePath = (data, minValue, maxValue) => {
  if (data.length < 2) {
    return '';
  }

  const range = maxValue - minValue || 1;
  return data
    .map((point, index) => {
      const x =
        PADDING + (index / (data.length - 1)) * (CHART_WIDTH - PADDING * 2);
      const y =
        CHART_HEIGHT -
        PADDING -
        ((point.value - minValue) / range) * (CHART_HEIGHT - PADDING * 2);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
};

const getRange = seriesData => {
  const values = seriesData.flatMap(series =>
    series.map(point => point.value)
  );

  if (!values.length) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
};

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

const LineChart = ({ data, series }) => {
  const mappedSeries = series.map(({ key, color, label }) => ({
    color,
    label,
    points: data.map(entry => ({
      value: entry[key],
    })),
  }));

  const { min, max } = getRange(mappedSeries.map(item => item.points));
  const lastTimestamp = data.at(-1)?.timestamp;

  if (!data.length) {
    return <div className="chart-empty">No data available.</div>;
  }

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
      >
        {mappedSeries.map(seriesItem => (
          <path
            key={seriesItem.label}
            d={buildLinePath(seriesItem.points, min, max)}
            stroke={seriesItem.color}
            strokeWidth="2"
            fill="none"
          />
        ))}
      </svg>
      <div className="chart__footer">
        <span>{formatTimestamp(lastTimestamp)}</span>
        <span>Time (UTC)</span>
      </div>
    </div>
  );
};

export default LineChart;
