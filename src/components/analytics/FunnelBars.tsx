interface FunnelItem { stage: string; label: string; count: number; ofTeachers: number }

export function FunnelBars({ funnel }: { funnel: FunnelItem[] }) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  return (
    <ol className="space-y-2">
      {funnel.map((f) => (
        <li key={f.stage} className="flex items-center gap-3">
          <span className="w-44 shrink-0 text-xs text-navy-800">{f.label}</span>
          <div className="flex-1 h-5 bg-softblue-100 rounded-md overflow-hidden">
            <div className="h-full bg-primary-600 rounded-md" style={{ width: `${Math.max((f.count / max) * 100, f.count > 0 ? 4 : 0)}%` }} />
          </div>
          <span className="w-16 text-right text-xs font-semibold text-navy-900">{f.count}</span>
        </li>
      ))}
    </ol>
  );
}
