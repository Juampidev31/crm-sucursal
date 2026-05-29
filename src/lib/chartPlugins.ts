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

      const pctValue = (val / total * 100);
      
      // Skip callout for very tiny slices if there are many items, to prevent unreadable text blobs
      if (datasetMeta.data.length > 5 && pctValue < 1.0) return;

      const pct = pctValue.toFixed(1) + '%';
      const centerPoint = (element as unknown as { tooltipPosition(): { x: number; y: number } }).tooltipPosition();
      const xCenter = left + width / 2;
      const yCenter = top + height / 2;
      const angle = Math.atan2(centerPoint.y - yCenter, centerPoint.x - xCenter);
      const radius = (element as unknown as { outerRadius: number }).outerRadius;

      // Stagger lengths so overlapping text gets separated vertically and horizontally
      const stagger = datasetMeta.data.length > 4 ? (index % 4) * 16 : 0;
      const xLineStart = xCenter + Math.cos(angle) * radius;
      const yLineStart = yCenter + Math.sin(angle) * radius;
      const xLineMid = xCenter + Math.cos(angle) * (radius + 12 + stagger);
      const yLineMid = yCenter + Math.sin(angle) * (radius + 12 + stagger);
      const isLeft = xLineMid < xCenter;
      const xLineEnd = xLineMid + (isLeft ? -10 : 10);

      ctx.beginPath();
      ctx.moveTo(xLineStart, yLineStart);
      ctx.lineTo(xLineMid, yLineMid);
      ctx.lineTo(xLineEnd, yLineMid);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#bbb';
      ctx.font = '600 10px "Outfit", sans-serif';
      ctx.textAlign = isLeft ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pct, xLineEnd + (isLeft ? -4 : 4), yLineMid);
    });
    ctx.restore();
  },
};

export const bgTrackPlugin: Plugin<'doughnut'> = {
  id: 'bgTrackPlugin',
  beforeDraw(chart: any) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;
    const arc = meta.data[0] as any;
    const x = arc.x;
    const y = arc.y;
    const outerRadius = arc.outerRadius;
    const innerRadius = arc.innerRadius;
    const thickness = outerRadius - innerRadius;
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, innerRadius + thickness / 2, 0, 2 * Math.PI);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.stroke();
    ctx.restore();
  }
};

export const glowPlugin: Plugin<'doughnut'> = {
  id: 'glowPlugin',
  beforeDatasetDraw(chart: any) {
    // Eliminado el efecto de iluminación de los donuts
  }
};
