/** CLI: npm run task <collect|verify-deadlines|cleanup|digest|reminders>  |  npm run task collect -- --source bcbl-career */
import "dotenv/config";
import { runSources } from "@/collectors/runner";
import { isTaskName, runTask, TASK_NAMES } from "@/tasks";

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  const sourceIndex = rest.indexOf("--source");
  if (name === "collect" && sourceIndex !== -1) {
    const keys = rest.slice(sourceIndex + 1).filter((k) => !k.startsWith("--"));
    const results = await runSources({ keys, force: true, trigger: "cli" });
    console.table(results.map((r) => ({ source: r.sourceKey, status: r.status, found: r.itemsFound, created: r.created, updated: r.updated, merged: r.merged, skipped: r.skipped, parseErrors: r.parseErrors, message: r.message })));
    return;
  }
  if (!name || !isTaskName(name)) {
    console.error(`Usage: npm run task <${TASK_NAMES.join("|")}> [-- --source <key> ...]`);
    process.exit(1);
  }
  const result = await runTask(name, "cli");
  console.log(`${name}: ${result.status} — ${result.message}`);
  if (result.status === "FAILED") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
