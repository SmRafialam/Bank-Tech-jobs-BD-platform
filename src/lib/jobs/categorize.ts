import type { JobCategory, JobLevel } from "@/generated/prisma/enums";

/**
 * Deterministic keyword categorisation. Title matches weigh far more than body matches.
 * An optional AI fallback can be plugged in via `setCategoryFallback` — it is never required.
 */
interface Rule {
  category: JobCategory;
  title: RegExp[];
  body: RegExp[];
}

const RULES: Rule[] = [
  {
    category: "CYBERSECURITY",
    title: [/\b(cyber|information|it|ict)[\s-]*security\b/, /\bsoc\b/, /\bsecurity (analyst|engineer|operations|officer)\b/, /\b(vapt|penetration|ciso|infosec)\b/],
    body: [/\bsiem\b/, /\bsoc\b/, /\bvapt\b/, /\biso ?27001\b/, /\bpci[ -]?dss\b/, /\bthreat\b/, /\bincident response\b/, /\bfirewall\b/],
  },
  {
    category: "IT_AUDIT_GOVERNANCE",
    title: [/\bit (audit|risk|governance|compliance)\b/, /\b(audit|risk|governance|compliance)[^,]*\b(it|ict|technology|information system)\b/, /\bis audit\b/],
    body: [/\bcisa\b/, /\bcobit\b/, /\bit governance\b/, /\bit audit\b/, /\brisk assessment\b/],
  },
  {
    category: "DATABASE",
    title: [/\b(database|dba)\b/, /\bdb (admin|administrator|engineer)\b/],
    body: [/\boracle (database|rac|dba)\b/, /\bpl\/?sql\b/, /\bsql server\b/, /\bpostgresql\b/, /\bbackup and recovery\b/],
  },
  {
    category: "NETWORK",
    title: [/\bnetwork\b/, /\b(lan|wan)\b/],
    body: [/\bccn[ap]\b/, /\brouting\b/, /\bswitching\b/, /\bbgp\b/, /\bospf\b/, /\bmpls\b/],
  },
  {
    category: "CLOUD_DEVOPS",
    title: [/\bdevops\b/, /\bcloud\b/, /\bsre\b/, /\bsite reliability\b/, /\bplatform engineer\b/],
    body: [/\bkubernetes\b/, /\bdocker\b/, /\bci\/cd\b/, /\bjenkins\b/, /\baws\b/, /\bazure\b/, /\bterraform\b/],
  },
  {
    category: "IT_INFRASTRUCTURE",
    title: [/\binfrastructure\b/, /\bsystem(s)? (admin|administrator|engineer)\b/, /\bsysadmin\b/, /\bdata ?cent(er|re)\b/, /\bhardware\b/, /\bit operations?\b/],
    body: [/\bvmware\b/, /\bwindows server\b/, /\blinux\b/, /\bactive directory\b/, /\bstorage\b/, /\bvirtuali[sz]ation\b/],
  },
  {
    category: "CARDS_PAYMENTS",
    title: [/\batm\b/, /\bcards?\b/, /\bpos\b/, /\bpayment/, /\bswitch\b/, /\bnpsb\b/],
    body: [/\biso ?8583\b/, /\bemv\b/, /\bcard management\b/, /\bpayment gateway\b/, /\batm\b/, /\bpos terminal/],
  },
  {
    category: "DIGITAL_BANKING",
    title: [/\bdigital (banking|channel|product|transformation|financial)/, /\binternet banking\b/, /\bmobile (banking|app)\b/, /\bmfs\b/],
    body: [/\binternet banking\b/, /\bmobile banking\b/, /\bdigital channel/, /\bomni[- ]?channel\b/, /\bmfs\b/],
  },
  {
    category: "DATA_BI",
    title: [/\bdata (analyst|engineer|scientist|analytics|science)\b/, /\bbusiness intelligence\b/, /\bbi (developer|analyst|engineer)\b/, /\banalytics\b/],
    body: [/\bpower ?bi\b/, /\btableau\b/, /\betl\b/, /\bdata warehouse\b/, /\bmachine learning\b/],
  },
  {
    category: "MIS_REPORTING",
    title: [/\bmis\b/, /\breporting\b/, /\bregulatory report/],
    body: [/\bmis report/, /\bcrystal reports?\b/, /\bssrs\b/, /\bregulatory reporting\b/, /\bcl reporting\b/],
  },
  {
    category: "QA_TESTING",
    title: [/\b(s?qa|quality assurance|tester|testing)\b/, /\btest (engineer|automation|analyst)\b/],
    body: [/\bselenium\b/, /\bjmeter\b/, /\btest cases?\b/, /\buat\b/, /\bregression testing\b/],
  },
  {
    category: "APPLICATION_SUPPORT",
    title: [/\bapplication support\b/, /\bcore banking\b/, /\bcbs\b/, /\bsupport engineer\b/, /\bapplication (officer|analyst)\b/, /\bit support\b/, /\bproduction support\b/],
    body: [/\bcore banking\b/, /\bt24\b/, /\bflexcube\b/, /\bfinacle\b/, /\bincident management\b/, /\bl2\b/, /\bl3\b/],
  },
  {
    category: "SOFTWARE_DEVELOPMENT",
    title: [/\bsoftware\b/, /\bdeveloper\b/, /\bprogrammer\b/, /\b(front|back)[- ]?end\b/, /\bfull[- ]?stack\b/, /\b(java|\.net|php|python|angular|react|flutter|android|ios)\b/, /\bsolution architect\b/, /\bapi\b/, /\bintegration engineer\b/, /\bsystem analyst\b/, /\bbusiness analyst\b/],
    body: [/\bjava\b/, /\bspring\b/, /\bangular\b/, /\breact\b/, /\bnode\.?js\b/, /\b\.net\b/, /\bmicroservices?\b/, /\brest(ful)? api/],
  },
];

const MTO = /\b(management trainee|mto|trainee officer|probationary officer)\b/;
const TECH_HINT = /\b(it|ict|cse|software|technology|digital|computer)\b/;

export interface CategorizationResult {
  category: JobCategory;
  secondary: JobCategory[];
  scores: Partial<Record<JobCategory, number>>;
}

type Fallback = (title: string, text: string) => JobCategory | null;
let fallback: Fallback | null = null;

/** Optional AI (or other) fallback, used only when no deterministic rule matched. */
export function setCategoryFallback(fn: Fallback | null) {
  fallback = fn;
}

export function categorizeJob(title: string, text = "", department = ""): CategorizationResult {
  const t = ` ${title.toLowerCase()} `;
  const body = `${department} ${text}`.toLowerCase();
  const scores: Partial<Record<JobCategory, number>> = {};

  for (const rule of RULES) {
    let score = 0;
    for (const re of rule.title) if (re.test(t)) score += 10;
    for (const re of rule.body) if (re.test(body)) score += 1;
    if (score > 0) scores[rule.category] = score;
  }

  if (MTO.test(t) && (TECH_HINT.test(t) || TECH_HINT.test(department.toLowerCase()))) {
    scores.MANAGEMENT_TRAINEE_TECH = (scores.MANAGEMENT_TRAINEE_TECH ?? 0) + 25;
  }

  const ranked = (Object.entries(scores) as [JobCategory, number][]).sort((a, b) => b[1] - a[1]);
  const titleMatched = ranked.filter(([, s]) => s >= 10);

  let category: JobCategory;
  if (titleMatched.length > 0) {
    category = titleMatched[0][0];
  } else {
    category = fallback?.(title, text) ?? "GENERAL_IT_OFFICER";
  }
  const secondary = ranked
    .filter(([c, s]) => c !== category && s >= 2)
    .slice(0, 3)
    .map(([c]) => c);

  return { category, secondary, scores };
}

// ─── Technology relevance ─────────────────────────────────────────────

const TECH_TITLE = [
  /\b(it|ict|mis|cbs|atm|pos|api|dba|soc|qa|sqa|bi|erp|devops|sre|noc)\b/,
  /\b(software|developer|programmer|database|network|system(s)? (admin|analyst|engineer)|sysadmin|security|cyber|cloud)\b/,
  /\b(data (analyst|engineer|scientist)|analytics|business intelligence|infrastructure|technology|digital|computer|tester|testing|automation)\b/,
  /\b(application support|core banking|integration|architect|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile app)\b/,
  /\b(java|\.net|php|python|angular|react|oracle|linux|flutter|android)\b/,
  /\b(card (system|technology|operations)|payment (system|technology)|switch|fintech)\b/,
];
const NON_TECH_ENGINEER = /\b(civil|mechanical|structural|architect(ure)? \(civil\)|electrical maintenance)\b/;
const TECH_DEPARTMENT = /\b(it|ict|information technology|technology|digital banking|mis|software|infrastructure|information security|cyber ?security)\b/;
const GENERIC_ENGINEER = /\bengineer\b/;

/** Whether a posting is a technology role worth listing. */
export function isTechJob(title: string, department = "", text = ""): boolean {
  const t = ` ${title.toLowerCase()} `;
  if (NON_TECH_ENGINEER.test(t)) return false;
  if (TECH_TITLE.some((re) => re.test(t))) return true;
  const dept = department.toLowerCase();
  if (TECH_DEPARTMENT.test(dept)) return true;
  if (GENERIC_ENGINEER.test(t)) return true;
  // Management trainee circulars that explicitly target CSE/IT graduates.
  if (MTO.test(t) && /\b(cse|computer science|information technology)\b/.test(text.toLowerCase())) return true;
  return false;
}

// ─── Level detection ─────────────────────────────────────────────────

export function detectLevel(title: string): JobLevel | null {
  const t = ` ${title.toLowerCase().replace(/\./g, " ")} `;
  if (/\b(trainee|intern|internship|mto|probationary|apprentice)\b/.test(t)) return "TRAINEE";
  if (/\b(chief|cto|cio|ciso|cdo|dmd|amd|evp|executive vice president|head of)\b/.test(t)) return "EXECUTIVE";
  if (/\b(svp|senior vice president|vp|vice president|unit head|team lead|lead)\b/.test(t)) return "LEAD";
  if (/\b(senior officer|sr officer|senior executive officer|executive officer)\b/.test(t)) return "MID";
  if (/\b(senior|sr|principal|avp|assistant vice president|manager|specialist)\b/.test(t)) return "SENIOR";
  if (/\b(junior|jr|assistant|associate|officer|trainee)\b/.test(t)) return "ENTRY";
  if (/\b(engineer|developer|analyst|programmer|administrator)\b/.test(t)) return "MID";
  return null;
}
