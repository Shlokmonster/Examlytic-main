import { LuChevronRight, LuCrown } from 'react-icons/lu';

export default function UpgradePromo() {
  return (
    <section className="v2-promo">
      <svg className="v2-promo__waves" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M0,${190 + i * 9} C90,${120 + i * 8} 170,${250 + i * 5} 260,${170 + i * 7} S380,${150 + i * 6} 400,${160 + i * 8}`}
            fill="none"
            stroke="var(--color-white)"
            strokeOpacity={0.06 + i * 0.008}
            strokeWidth="1"
          />
        ))}
      </svg>

      <span className="v2-promo__icon" aria-hidden="true">
        <LuCrown />
      </span>

      <div className="v2-promo__text">
        <h2 className="v2-promo__title">Unlock Your Full Exam Potential</h2>
        <p className="v2-promo__body">
          Access advanced tools, in-depth analytics, and unlimited exam opportunities with our Premium plan.
        </p>
      </div>

      <button type="button" className="v2-promo__cta">
        Upgrade Now <LuChevronRight aria-hidden="true" />
      </button>
    </section>
  );
}
