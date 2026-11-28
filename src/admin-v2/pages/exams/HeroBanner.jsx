import { useNavigate } from 'react-router-dom';
import { LuChevronRight } from 'react-icons/lu';
import { ADMIN_V2_BASE } from '../../layout/navItems';

/** Four-point sparkle star, as in the reference banner. */
function Sparkle({ x, y, size, opacity }) {
  const h = size / 2;
  const w = size / 14;
  return (
    <path
      d={`M${x},${y - h} C${x + w},${y - w} ${x + w},${y - w} ${x + h},${y} C${x + w},${y + w} ${x + w},${y + w} ${x},${y + h} C${x - w},${y + w} ${x - w},${y + w} ${x - h},${y} C${x - w},${y - w} ${x - w},${y - w} ${x},${y - h} Z`}
      fill="var(--color-white)"
      fillOpacity={opacity}
    />
  );
}

export default function HeroBanner() {
  const navigate = useNavigate();
  return (
    <section className="v2-hero">
      <svg className="v2-hero__sparkles" viewBox="0 0 800 250" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <Sparkle x={415} y={45} size={64} opacity={0.35} />
        <Sparkle x={590} y={125} size={150} opacity={0.45} />
        <Sparkle x={490} y={232} size={46} opacity={0.18} />
        <Sparkle x={770} y={222} size={52} opacity={0.22} />
        <Sparkle x={730} y={20} size={60} opacity={0.12} />
      </svg>

      <div className="v2-hero__content">
        <p className="v2-hero__eyebrow">Manage Exams Like a Pro</p>
        <h2 className="v2-hero__title">
          From creation to
          <br />
          results—handle it all here.
        </h2>
        <button type="button" className="v2-hero__cta" onClick={() => navigate(`${ADMIN_V2_BASE}/exams/new`)}>
          <span>Schedule an Exam</span>
          <span className="v2-hero__cta-icon" aria-hidden="true">
            <LuChevronRight />
          </span>
        </button>
      </div>
    </section>
  );
}
