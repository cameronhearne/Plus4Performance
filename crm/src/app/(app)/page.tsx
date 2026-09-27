import Link from "next/link";
import { getDashboardData } from "@/lib/queries";
import { STAGE_LABELS, SOURCE_LABELS, formatGBP, formatDate } from "@/lib/domain";
import { StatTile } from "@/components/StatTile";
import { BarList } from "@/components/BarList";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const totalPipelineValue = data.pipelineByStage
    .filter((p) => p.stage !== "won" && p.stage !== "lost")
    .reduce((sum, p) => sum + p.value, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Pipeline overview at a glance.</p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Pipeline Value" value={formatGBP(totalPipelineValue)} />
        <StatTile
          label="Won This Month"
          value={formatGBP(data.wonThisMonthValue)}
          sub={`${data.wonThisMonthCount} client${data.wonThisMonthCount === 1 ? "" : "s"}`}
        />
        <StatTile label="Active Leads" value={String(data.activeLeads)} />
        <StatTile
          label="Tasks Due"
          value={String(data.dueTasks.length)}
          sub="today or overdue"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text">Pipeline Value by Stage</h2>
          <BarList
            items={data.pipelineByStage.map((p) => ({
              label: STAGE_LABELS[p.stage],
              value: p.value,
              display: formatGBP(p.value),
            }))}
          />
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text">Conversion Rate by Source</h2>
          <BarList
            items={data.conversionBySource.map((s) => ({
              label: SOURCE_LABELS[s.source as keyof typeof SOURCE_LABELS],
              value: s.rate,
              display: `${s.rate.toFixed(0)}% (${s.total})`,
            }))}
          />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text">Tasks Due Today / Overdue</h2>
          {data.dueTasks.length === 0 ? (
            <p className="text-sm text-text-faint">Nothing due. You&apos;re clear.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueTasks.map((task) => {
                const overdue = task.due_date && new Date(task.due_date) < today;
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="text-text">{task.title}</div>
                      <Link
                        href={`/contacts/${task.contact?.id}`}
                        className="text-xs text-text-muted hover:text-accent"
                      >
                        {task.contact?.name}
                      </Link>
                    </div>
                    <span className={`text-xs ${overdue ? "text-danger" : "text-warning"}`}>
                      {formatDate(task.due_date)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text">Pending Email Queue</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
              {data.pendingEmailCount} pending
            </span>
          </div>
          {data.pendingEmails.length === 0 ? (
            <p className="text-sm text-text-faint">No pending sends.</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingEmails.map((send) => (
                <li
                  key={send.id}
                  className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-text">{send.sequence?.name}</span>
                    <span className="text-xs text-text-faint">
                      {formatDate(send.scheduled_for)}
                    </span>
                  </div>
                  <Link
                    href={`/contacts/${send.contact?.id}`}
                    className="text-xs text-text-muted hover:text-accent"
                  >
                    {send.contact?.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
