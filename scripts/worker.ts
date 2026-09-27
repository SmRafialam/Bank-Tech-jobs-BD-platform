/**
 * Long-running scheduler for VPS/Docker deployments. Runs every task on its cron schedule (Asia/Dhaka),
 * reloads schedules edited in the admin dashboard every 5 minutes, and never runs two instances of a task at once
 * (database lease in src/tasks/index.ts).
 */
import "dotenv/config";
import { Cron } from "croner";
import { runTask, TASK_NAMES, type TaskName } from "@/tasks";
import { getSchedules, SCHEDULE_TIMEZONE } from "@/tasks/schedules";

const jobs = new Map<TaskName, { expression: string; cron: Cron }>();

async function apply() {
  const schedules = await getSchedules();
  for (const task of TASK_NAMES) {
    const expression = schedules[task];
    const current = jobs.get(task);
    if (current?.expression === expression) continue;
    current?.cron.stop();
    const cron = new Cron(expression, { timezone: SCHEDULE_TIMEZONE, protect: true, name: task }, async () => {
      const started = Date.now();
      const result = await runTask(task, "worker");
      console.log(`[worker] ${task} ${result.status} in ${Date.now() - started}ms — ${result.message}`);
    });
    jobs.set(task, { expression, cron });
    console.log(`[worker] ${task} scheduled "${expression}" (${SCHEDULE_TIMEZONE}); next run ${cron.nextRun()?.toISOString()}`);
  }
}

async function main() {
  await apply();
  setInterval(() => apply().catch((e) => console.error("[worker] reload failed", e)), 5 * 60_000);
  if (process.argv.includes("--run-now")) await runTask("collect", "worker-startup");
  const shutdown = () => {
    for (const { cron } of jobs.values()) cron.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
