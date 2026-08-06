export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center rounded-card border border-dashed border-border bg-white text-center">
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">Coming soon.</p>
    </div>
  );
}
