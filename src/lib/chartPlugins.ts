import type { Plugin } from 'chart.js';

/**
 * Doughnut callout plugin — draws a leader line + percentage label
 * for each non-zero slice. Used by analistas page and MetricasTab.
 */
export const calloutPlugin: Plugin<'doughnut'> = {
  id: 'calloutPlugin',
  afterDraw(chart) {
    const { ctx, chartArea: { top, left, width, height } } = chart;
    const datasetMeta = chart.getDatasetMeta(0);
    if (!datasetMeta?.data?.length) return;

    let total = 0;
    (chart.data.datasets[0].data as number[]).forEach(v => { total += v; });
    if (total === 0) return;

    ctx.save();
    datasetMeta.data.forEach((element, index) => {
      const val = (chart.data.datasets[0].data as number[])[index];
      if (!val) return;

      const pct = (val / total * 100).toFixed(1) + '%';
      const centerPoint = (element as unknown as { tooltipPosition(): { x: number; y: number } }).tooltipPosition();
      const xCenter = left + width / 2;
      const yCenter = top + height / 2;
      const angle = Math.atan2(centerPoint.y - yCenter, centerPoint.x - xCenter);
      const radius = (element as unknown as { outerRadius: number }).outerRadius;

      const xLineStart = xCenter + Math.cos(angle) * radius;
      const yLineStart = yCenter + Math.sin(angle) * radius;
      const xLineMid = xCenter + Math.cos(angle) * (radius + 14);
      const yLineMid = yCenter + Math.sin(angle) * (radius + 14);
      const isLeft = xLineMid < xCenter;
      const xLineEnd = xLineMid + (isLeft ? -12 : 12);

      ctx.beginPath();
      ctx.moveTo(xLineStart, yLineStart);
      ctx.lineTo(xLineMid, yLineMid);
      ctx.lineTo(xLineEnd, yLineMid);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#aaa';
      ctx.font = '600 10px "Outfit", sans-serif';
      ctx.textAlign = isLeft ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pct, xLineEnd + (isLeft ? -4 : 4), yLineMid);
    });
    ctx.restore();
  },
};
