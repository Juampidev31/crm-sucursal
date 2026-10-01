'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type DistBlockStyle = React.CSSProperties & {
  '--dist-color': string;
};

type ProgressStyle = React.CSSProperties & {
  '--dist-progress': string;
};

const DistBlock = ({
  titulo, icon, datos, color, totalMes, maxItems = 5, theme = 'dark',
}: {
  titulo: string;
  icon: React.ReactNode;
  datos: { label: string; monto: number; cantidad: number }[];
  color: string;
  totalMes: number;
  maxItems?: number;
  theme?: 'dark' | 'elevated';
}) => {
  const [expanded, setExpanded] = useState(false);

  const validData = datos.filter((item) => {
    const label = item.label?.trim()?.toLowerCase();
    return label !== 'no especificado' && label !== 'sin dato' && label !== '';
  });

  const unspecified = datos.find((item) => {
    const label = item.label?.trim()?.toLowerCase();
    return label === 'no especificado' || label === 'sin dato' || label === '';
  });

  const totalCount = validData.reduce((sum, item) => sum + item.cantidad, 0);
  const displayData = expanded ? validData : validData.slice(0, maxItems);
  const hasMore = validData.length > maxItems;
  const rootClassName = [
    'report-dist-block',
    theme === 'elevated' ? 'report-dist-block--elevated' : 'report-dist-block--standard',
    expanded ? 'is-expanded' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} style={{ '--dist-color': color } as DistBlockStyle}>
      <div className="report-dist-block__heading">
        <div className="report-dist-block__icon">{icon}</div>
        <span className="report-dist-block__title">{titulo}</span>
      </div>

      <div className="report-dist-block__panel">
        <div className="report-dist-block__list">
          {displayData.map((item, index) => {
            const percentage = totalCount > 0 ? (item.cantidad / totalCount) * 100 : 0;
            const amountPercentage = totalMes > 0 ? (item.monto / totalMes) * 100 : 0;

            return (
              <div className="report-dist-block__row" key={`${item.label}-${index}`}>
                <div className="report-dist-block__row-head">
                  <span className="report-dist-block__label">{item.label?.trim()}</span>
                  <div className="report-dist-block__metrics">
                    <span className="report-dist-block__amount">{formatCurrency(item.monto)}</span>
                    <span className="report-dist-block__count">{item.cantidad}</span>
                    <span className="report-dist-block__percentage">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="report-dist-block__track">
                  <div
                    className="report-dist-block__progress"
                    style={{ '--dist-progress': `${amountPercentage}%` } as ProgressStyle}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {unspecified && unspecified.cantidad > 0 && (
          <div className="report-dist-block__unspecified">
            <span className="report-dist-block__unspecified-label">
              * {unspecified.cantidad} sin especificar
            </span>
            <span className="report-dist-block__unspecified-amount">{formatCurrency(unspecified.monto)}</span>
          </div>
        )}

        <div className="report-dist-block__footer">
          <button
            aria-disabled={!hasMore}
            className="report-dist-block__button"
            onClick={() => hasMore && setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? 'Ver menos' : `Ver todos (${validData.length})`}
            {hasMore && (
              <ChevronDown
                className={`report-dist-block__chevron${expanded ? ' is-expanded' : ''}`}
                size={12}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DistBlock;
