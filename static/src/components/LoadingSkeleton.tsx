import type { CSSProperties } from 'react';
import { modeLabels, type Mode } from '../core';
import './loading-skeleton.css';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function ResultsSkeleton({ modes }: { modes: Mode[] }) {
  const tableStyle = { '--table-min-width': `${500 + modes.length * 115}px` } as CSSProperties;
  return <section className="results-loading" aria-label="Loading pharmacy options">
    <span className="visually-hidden" role="status">Loading pharmacy options…</span>
    <div className="table-shell" aria-hidden="true"><div className="table-scroll">
      <table className="table skeleton-table" style={tableStyle}>
        <thead><tr><th>Pharmacy</th><th>Medication</th><th>Availability</th>{modes.map((mode) => <th key={mode}>{modeLabels[mode]}<div className="header-metrics"><Skeleton className="skeleton-short" /></div></th>)}<th /></tr></thead>
        <tbody>{[0, 1, 2, 3].map((row) => <tr key={row}>
          <td><Skeleton className="skeleton-name" /><Skeleton className="skeleton-text" /><Skeleton className="skeleton-short" /></td>
          <td><Skeleton className="skeleton-price" /></td>
          <td><Skeleton className="skeleton-short" /></td>
          {modes.map((mode) => <td className="method" data-label={modeLabels[mode]} key={mode}><Skeleton className="skeleton-mode" /><Skeleton className="skeleton-short" /><Skeleton className="skeleton-text" /></td>)}
          <td><Skeleton className="skeleton-short" /></td>
        </tr>)}</tbody>
      </table>
    </div><div className="table-foot"><Skeleton className="skeleton-text" /></div></div>
    <div className="map-section" aria-hidden="true"><div className="map-head"><Skeleton className="skeleton-name" /></div><div className="map-illustration skeleton-map" /></div>
  </section>;
}

export function ProductsSkeleton() {
  return <section aria-label="Loading products">
    <span className="visually-hidden" role="status">Loading products…</span>
    <div className="product-grid" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((card) => <article className="product-card skeleton-product" key={card}>
      <div className="product-card-top"><Skeleton className="skeleton-short" /><Skeleton className="skeleton-short" /></div>
      <Skeleton className="skeleton-name" /><Skeleton className="skeleton-text" />
      <div className="product-aliases"><Skeleton className="skeleton-chip" /><Skeleton className="skeleton-chip" /></div>
      <div className="product-compare"><Skeleton className="skeleton-text" /></div>
    </article>)}</div>
  </section>;
}

export function PreviewSkeleton() {
  return <div className="preview-skeleton">
    <span className="visually-hidden" role="status">Finding nearby options…</span>
    <div className="landing-preview-product" aria-hidden="true"><Skeleton className="skeleton-name" /><Skeleton className="skeleton-text" /></div>
    <div className="landing-preview-offers" aria-hidden="true">{[0, 1, 2].map((row) => <div className="landing-preview-offer" key={row}>
      <Skeleton className="skeleton-pin" /><div><Skeleton className="skeleton-short" /><Skeleton className="skeleton-text" /><Skeleton className="skeleton-short" /></div><Skeleton className="skeleton-price" />
    </div>)}</div>
  </div>;
}
