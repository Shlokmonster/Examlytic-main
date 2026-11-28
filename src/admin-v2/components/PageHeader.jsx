import { LuSearch } from 'react-icons/lu';
import { Card } from './ui';
import DateLine from './DateLine';

/**
 * Standard page header card: title (+ optional date) on the left;
 * search, then any action buttons (children) on the right.
 */
export default function PageHeader({
  title,
  showDate = false,
  search,
  onSearch,
  searchPlaceholder = 'eg; search exam...',
  children,
}) {
  return (
    <Card className="v2-page-header">
      <div>
        <h1 className="h1">{title}</h1>
        {showDate && <DateLine />}
      </div>

      <div className="v2-page-header__actions">
        {onSearch && (
          <label className="v2-page-search">
            <LuSearch aria-hidden="true" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={`Search ${title}`}
            />
          </label>
        )}
        {children}
      </div>
    </Card>
  );
}
