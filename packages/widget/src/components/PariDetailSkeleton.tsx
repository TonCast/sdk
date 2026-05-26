import { Skeleton } from "./ui/Skeleton";

/**
 * Placeholder for {@link PariDetailView} hero + bet columns.
 * Renders as direct children of the parent `.tc-detail-layout` (no nested layout wrapper).
 */
export function PariDetailSkeleton() {
  return (
    <>
      <div className="tc-detail-col-main" aria-hidden="true">
        <div className="tc-card">
          <div className="tc-detail-img-wrapper">
            <Skeleton className="tc-pari-cover" />
          </div>
          <div className="tc-card-body tc-detail-card-body">
            <Skeleton style={{ width: "85%", height: 28 }} />
            <Skeleton style={{ width: "100%", height: 48, marginTop: 8 }} />
            <div className="tc-detail-meta">
              <Skeleton style={{ width: 96, height: 16 }} />
              <Skeleton style={{ width: 96, height: 16 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="tc-detail-col-bet" aria-hidden="true">
        <div className="tc-card tc-card-body tc-form-col-sm">
          <Skeleton style={{ width: "55%", height: 18 }} />
          <Skeleton style={{ width: "100%", height: 36 }} />
          <Skeleton style={{ width: "100%", height: 36 }} />
          <Skeleton style={{ width: "100%", height: 40 }} />
          <Skeleton style={{ width: "100%", height: 120 }} />
        </div>
      </div>
    </>
  );
}

/** Skeleton for the coefficient chart block (KPI + sparkline layout). */
export function PariChartSkeleton() {
  return (
    <div className="tc-chart" aria-hidden="true">
      <div className="tc-chart-layout">
        <div className="tc-chart-kpi">
          <Skeleton className="tc-chart-kpi-title-skeleton" />
          <div className="tc-chart-kpi-row">
            <Skeleton style={{ width: 56, height: 28 }} />
            <Skeleton style={{ width: 52, height: 22, borderRadius: 999 }} />
          </div>
        </div>
        <div className="tc-chart-canvas">
          <Skeleton className="tc-chart-canvas-skeleton" />
        </div>
      </div>
    </div>
  );
}
