import { useEffect, useRef } from 'react';
import { LuCheck, LuMinus } from 'react-icons/lu';

/** Styled native checkbox (keyboard + screen reader friendly). Supports `indeterminate`. */
export default function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="v2-checkbox" onClick={(e) => e.stopPropagation()}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="v2-checkbox__box" aria-hidden="true">
        {indeterminate ? <LuMinus /> : <LuCheck />}
      </span>
    </label>
  );
}
