import { Card, Skeleton } from './ui';

/**
 * Small KPI card: label + tinted round icon on top, value row at the bottom.
 * tone: success | warning | danger | primary
 */
export default function StatCard({ label, icon, tone = 'primary', children }) {
  const Icon = icon;
  return (
    <Card className="v2-stat">
      <div className="v2-stat__top">
        <span className="v2-stat__label">{label}</span>
        <span className={`v2-stat__icon v2-stat__icon--${tone}`}>
          <Icon aria-hidden="true" />
        </span>
      </div>
      <div className="v2-stat__value">{children}</div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="v2-stat">
      <Skeleton height={14} width="60%" />
      <Skeleton height={28} width="80%" style={{ marginTop: 'auto' }} />
    </Card>
  );
}
