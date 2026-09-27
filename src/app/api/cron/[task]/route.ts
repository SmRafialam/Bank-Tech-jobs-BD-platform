import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isTaskName, runTask } from "@/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Scheduled task trigger for Vercel Cron (GET) and GitHub Actions / external schedulers (POST). */
async function handle(request: NextRequest, { params }: { params: Promise<{ task: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { task } = await params;
  if (!isTaskName(task)) return NextResponse.json({ error: "Unknown task" }, { status: 404 });
  const result = await runTask(task, "http");
  return NextResponse.json({ task, ...result }, { status: result.status === "FAILED" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
