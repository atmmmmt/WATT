interface StatCardProps {
  title: string;
  value: string | number;
  tone?: 'default' | 'accent';
}

export function StatCard({ title, value, tone = 'default' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{title}</p>
      <strong>{value}</strong>
    </article>
  );
}
