export function MyTasksPage() {
  const tasks = [
    { id: "TASK-41", title: "Investigate replay pattern", priority: "High", due: "12m" },
    { id: "TASK-42", title: "Validate SCADA rule update", priority: "Medium", due: "28m" },
    { id: "TASK-43", title: "Confirm blocked IP ticket", priority: "Low", due: "45m" }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Tasks Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">My Tasks</h1>
      <p className="mt-1 text-sm text-muted">Assigned analyst tasks for the current authenticated user.</p>

      <div className="mt-5 space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">{task.id} - {task.title}</p>
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">{task.priority}</span>
            </div>
            <p className="mt-1 text-xs text-muted">SLA remaining: {task.due}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
