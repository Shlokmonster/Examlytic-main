import { Link } from 'react-router-dom';
import { getTopPerformers } from '../../data/students';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';
import Avatar from '../../components/Avatar';
import { ADMIN_V2_BASE } from '../../layout/navItems';

export default function TopPerformers() {
  const { data } = useData(getTopPerformers);

  return (
    <Card className="v2-performers">
      <h2 className="v2-side-title">Top Performers</h2>
      {!data ? (
        <Skeleton height={240} style={{ marginTop: 16 }} />
      ) : (
        <ol className="v2-performers__list">
          {data.map((s, i) => (
            <li key={s.id}>
              <Link to={`${ADMIN_V2_BASE}/students/${s.id}`} className="v2-performers__item">
                <span className={`v2-performers__rank ${i === 0 ? 'is-first' : ''}`}>{i + 1}</span>
                <Avatar name={s.user_name} src={s.user_avatar} size={36} />
                <span className="v2-person__text">
                  <span className="v2-person__name">{s.user_name}</span>
                  <span className="v2-person__email">{s.class_name}</span>
                </span>
                <span className="v2-performers__score">{s.avg_score}%</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
