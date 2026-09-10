export function EmptyState({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon ?? '◌'}
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
