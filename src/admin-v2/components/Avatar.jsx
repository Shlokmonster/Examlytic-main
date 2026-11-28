function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

/** Round avatar: the image when there is one, otherwise initials on teal. */
export default function Avatar({ name, src, size = 36 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (src) {
    return <img className="v2-avatar" src={src} alt="" style={style} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="v2-avatar v2-avatar--initials" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
