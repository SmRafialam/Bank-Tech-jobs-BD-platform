/**
 * Minimal RFC 9309 robots.txt parser: user-agent groups, Allow/Disallow with `*` and `$`, longest match wins,
 * Allow wins ties.
 */
interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface RobotsPolicy {
  isAllowed(pathWithQuery: string): boolean;
  crawlDelaySeconds: number | null;
}

export function parseRobots(content: string, userAgentToken: string): RobotsPolicy {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  const delays = new Map<Group, number>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "allow everything" — it contributes no rule.
      if (value === "" && field === "disallow") continue;
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n)) delays.set(current, n);
    }
  }

  const token = userAgentToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const selected = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = selected.flatMap((g) => g.rules);
  const crawlDelay = selected.map((g) => delays.get(g)).find((d) => d != null) ?? null;

  return {
    crawlDelaySeconds: crawlDelay,
    isAllowed(path: string) {
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!matches(rule.pattern, path)) continue;
        if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    `^${body
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}${anchored ? "$" : ""}`,
  );
  return regex.test(path);
}

export const ALLOW_ALL: RobotsPolicy = { isAllowed: () => true, crawlDelaySeconds: null };
export const DISALLOW_ALL: RobotsPolicy = { isAllowed: () => false, crawlDelaySeconds: null };
