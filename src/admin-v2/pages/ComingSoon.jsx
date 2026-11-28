import { Card } from '../components/ui';

/** Placeholder for admin v2 pages that haven't been built yet. */
export default function ComingSoon({ title }) {
  return (
    <Card style={{ padding: 'var(--space-8)' }}>
      <h1 className="h1">{title}</h1>
      <p className="body-1 text-secondary" style={{ margin: 'var(--space-2) 0 0' }}>
        This page is coming soon.
      </p>
    </Card>
  );
}
