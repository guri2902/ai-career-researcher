export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Dashboard
        </p>

        <h1 className="mt-3 text-4xl font-semibold text-secondary">
          Your Career Dashboard
        </h1>

        <div className="mt-10 rounded-2xl border border-border bg-card p-10">
          <h2 className="text-xl font-semibold text-secondary">
            No jobs analyzed yet
          </h2>

          <p className="mt-2 text-muted-foreground">
            Add your first job to start building your preparation plan.
          </p>
        </div>
      </div>
    </main>
  );
}