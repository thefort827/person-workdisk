/**
 * 图表封装：Chart.js 深色主题默认值 + 便捷创建
 */

// 统一配色（小清新马卡龙）
export const PALETTE = {
  accent: '#4dd6a8',
  accent2: '#4aa8f0',
  green: '#4cd1a0',
  red: '#ff7b8a',
  orange: '#ffb35c',
  yellow: '#f3c948',
  cyan: '#5fd3d3',
  pink: '#f0a6c8',
  purple: '#9d8cff',
  slate: 'rgba(80,130,120,0.35)',
};

export const SERIES = ['#4dd6a8', '#5aa9f5', '#ffb35c', '#ff8fa3', '#9d8cff', '#f3c948', '#5fd3d3', '#f0a6c8', '#a3d977', '#7fc4f0'];

export function initChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#7d92a8';
  Chart.defaults.borderColor = 'rgba(80,130,120,0.14)';
  Chart.defaults.font.family = '"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif';
  Chart.defaults.font.size = 11.5;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255,255,255,0.98)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(80,130,120,0.2)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleColor = '#34475c';
  Chart.defaults.plugins.tooltip.bodyColor = '#5c6f84';
  Chart.defaults.plugins.tooltip.titleFont = { weight: '700' };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
  Chart.defaults.plugins.tooltip.boxPadding = 4;
}

/** 创建图表：自动销毁 canvas 上的旧实例 */
export function makeChart(canvasId, config) {
  const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
  if (!canvas) return null;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  return new Chart(canvas, config);
}

export function axisGrid() {
  return { grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'rgba(255,255,255,0.1)' }, ticks: { maxTicksLimit: 8 } };
}

export function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    ...extra,
  };
}

export const moneyFmt = (v) => (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString('zh-CN'));
