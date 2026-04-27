type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__badge">还没有数据</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
