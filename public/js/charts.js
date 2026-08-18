/**
 * 图表封装：Chart.js 深色主题默认值 + 便捷创建
 */

// 统一配色
export const PALETTE = {
  accent: '#5b78ff',
  accent2: '#8a5bff',
  green: '#2fd99a',
  red: '#ff5464',
  orange: '#ff9b42',
  yellow: '#f7d046',
  cyan: '#31c6e8',
  pink: '#ec6aa8',
  purple: '#a78bfa',
  slate: 'rgba(255,255,255,0.22)',
};

export const SERIES = ['#5b78ff', '#31c6e8', '#2fd99a', '#ff9b42', '#f7d046', '#ff5464', '#8a5bff', '#ec6aa8', '#a78bfa', '#5fd9d3'];

export function initChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#9aa0bd';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
  Chart.defaults.font.family = '"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif';
  Chart.defaults.font.size = 11.5;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(14,18,38,0.95)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.14)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
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
