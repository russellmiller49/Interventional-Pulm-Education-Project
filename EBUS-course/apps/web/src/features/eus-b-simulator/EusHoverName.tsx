interface EusHoverNameProps {
  /** Pointer position inside the view, in CSS pixels, and the size of the view. */
  left: number;
  top: number;
  boxWidth: number;
  boxHeight: number;
  label: string;
  /** CSS color of the structure's swatch, when it has one. */
  color?: string | null;
  /** What kind of structure it is. */
  kind?: string | null;
  /** A caveat that belongs with the name, such as a contour that marks a location. */
  note?: string;
}

/**
 * The name of whatever is under the pointer, in the ultrasound image or on the 3D model.
 *
 * It sits just below the pointer and slides sideways across its own width as the pointer crosses
 * the view, so it never leaves the view and never covers the point being named.
 */
export function EusHoverName({
  left,
  top,
  boxWidth,
  boxHeight,
  label,
  color,
  kind,
  note,
}: EusHoverNameProps) {
  const across = boxWidth > 0 ? Math.min(Math.max(left / boxWidth, 0), 1) : 0;
  const above = top > boxHeight * 0.68;
  return (
    <div
      className="eus-hover-name"
      aria-hidden="true"
      style={{
        left,
        top,
        transform: `translate(${(-across * 100).toFixed(1)}%, ${above ? 'calc(-100% - 12px)' : '20px'})`,
      }}
    >
      <span className="eus-hover-name__title">
        {color && <span className="eus-swatch" style={{ backgroundColor: color }} />}
        {label}
      </span>
      {kind && <span className="eus-hover-name__kind">{kind}</span>}
      {note && <span className="eus-hover-name__note">{note}</span>}
    </div>
  );
}
