import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

/** Page numbers with ellipses: 1 … 4 5 6 … 10 */
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="v2-pagination" aria-label="Pagination">
      <span className="v2-pagination__info">
        Showing {from}–{to} of {total}
      </span>
      <div className="v2-pagination__pages">
        <button
          type="button"
          className="v2-pagination__btn"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <LuChevronLeft aria-hidden="true" />
        </button>
        {pageList(page, pages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="v2-pagination__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`v2-pagination__btn ${p === page ? 'is-active' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="v2-pagination__btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <LuChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
