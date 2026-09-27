import type { WorkMode } from "@/generated/prisma/enums";
import { parseDhakaDate } from "@/lib/time";
import { unique } from "@/lib/utils";

/**
 * Requirement extraction from the plain text of a job circular.
 * Every field is `null`/empty when the text does not state it — callers must treat that as "Not specified".
 */
export interface ExtractedRequirements {
  educationDisciplines: string[];
  disciplineNote: string | null;
  minCgpa: number | null;
  minSscGpa: number | null;
  minHscGpa: number | null;
  sscHscRequirement: string | null;
  mastersRequired: boolean | null;
  noThirdDivision: boolean | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  ageLimit: number | null;
  bankingExperiencePreferred: boolean;
  requiredSkills: string[];
  preferredSkills: string[];
  vacancies: number | null;
  salary: string | null;
  deadline: Date | null;
  location: string | null;
  workMode: WorkMode | null;
  requirementsParsed: boolean;
}

/** Canonical discipline codes. `RELATED` means "or related discipline" was stated. */
const DISCIPLINES: [string, RegExp][] = [
  ["CSE", /\bcse\b|computer science (and|&) engineering/],
  ["CS", /\bcs\b|\bcomputer science\b(?! (and|&) engineering)/],
  ["IT", /\binformation technology\b|\b(b\.?sc|bachelor)[^.,;\n]{0,20}\bit\b/],
  ["SWE", /\bsoftware engineering\b|\bswe\b/],
  ["EEE", /\beee\b|electrical (and|&) electronic(s)? engineering/],
  ["ECE", /\bece\b|electronics? (and|&) communication engineering/],
  ["ETE", /\bete\b|electronics? (and|&) telecommunication engineering/],
  ["ICT", /\bict\b|information (and|&) communication technology/],
  ["MIS", /\bmanagement information systems?\b/],
  ["STATISTICS", /\bstatistics\b/],
  ["MATHEMATICS", /\bmathematics\b|\bapplied math/],
  ["PHYSICS", /\bphysics\b/],
  ["ANY", /\bany discipline\b|\ball disciplines\b|\bany subject\b/],
];

export const TECH_DISCIPLINES = ["CSE", "CS", "IT", "SWE", "EEE", "ECE", "ETE", "ICT", "MIS"];

/** Map a free-text degree discipline (profile) to a canonical code. */
export function canonicalDiscipline(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = ` ${value.toLowerCase()} `;
  for (const [code, re] of DISCIPLINES) {
    if (code === "ANY") continue;
    if (re.test(text)) return code;
  }
  return value.trim().toUpperCase();
}

export const SKILL_DICTIONARY: [string, RegExp][] = [
  ["Angular", /\bangular(js)?\b/],
  ["React", /\breact(\.js|js)?\b/],
  ["TypeScript", /\btypescript\b/],
  ["JavaScript", /\bjavascript\b|(?<![.\w])js\b/],
  ["Node.js", /\bnode(\.js|js)?\b/],
  ["NestJS", /\bnest(\.js|js)\b/],
  ["Java", /\bjava\b(?!script)/],
  ["Spring Boot", /\bspring( boot)?\b/],
  [".NET", /(^|\s)(\.net|asp\.net|dotnet)\b/],
  ["C#", /\bc#/],
  ["Python", /\bpython\b/],
  ["PHP", /\bphp\b/],
  ["Laravel", /\blaravel\b/],
  ["Flutter", /\bflutter\b/],
  ["Android", /\bandroid\b/],
  ["REST APIs", /\brest(ful)?( apis?| web services?)\b|\bapis?\b/],
  ["SOAP", /\bsoap\b/],
  ["Microservices", /\bmicroservices?\b/],
  ["Oracle", /\boracle\b/],
  ["PL/SQL", /\bpl\/?sql\b/],
  ["SQL", /\bsql\b/],
  ["SQL Server", /\b(ms )?sql server\b|\bmssql\b/],
  ["PostgreSQL", /\bpostgres(ql)?\b/],
  ["MySQL", /\bmysql\b/],
  ["MongoDB", /\bmongo(db)?\b/],
  ["Linux", /\blinux\b|\brhel\b|\bubuntu\b/],
  ["Windows Server", /\bwindows server\b/],
  ["Active Directory", /\bactive directory\b/],
  ["VMware", /\bvmware\b|\bvsphere\b/],
  ["Cisco", /\bcisco\b/],
  ["CCNA", /\bccna\b/],
  ["CCNP", /\bccnp\b/],
  ["Firewall", /\bfirewalls?\b|\bfortigate\b|\bpalo alto\b/],
  ["SIEM", /\bsiem\b|\bqradar\b|\bsplunk\b/],
  ["ISO 27001", /\biso ?27001\b/],
  ["PCI DSS", /\bpci[ -]?dss\b/],
  ["CISA", /\bcisa\b/],
  ["CISSP", /\bcissp\b/],
  ["ITIL", /\bitil\b/],
  ["COBIT", /\bcobit\b/],
  ["Docker", /\bdocker\b/],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/],
  ["AWS", /\baws\b|\bamazon web services\b/],
  ["Azure", /\bazure\b/],
  ["CI/CD", /\bci\/cd\b|\bjenkins\b|\bgitlab ci\b/],
  ["Git", /\bgit\b|\bgithub\b|\bgitlab\b/],
  ["Core Banking (T24/Flexcube/Finacle)", /\bt24\b|\bflexcube\b|\bfinacle\b|\btemenos\b|\bcore banking\b/],
  ["Power BI", /\bpower ?bi\b/],
  ["Tableau", /\btableau\b/],
  ["ETL", /\betl\b/],
  ["Crystal Reports / SSRS", /\bcrystal reports?\b|\bssrs\b/],
  ["Excel / VBA", /\bexcel\b|\bvba\b/],
  ["Selenium", /\bselenium\b/],
  ["JMeter", /\bjmeter\b/],
  ["Kafka", /\bkafka\b/],
  ["ISO 8583 / EMV", /\biso ?8583\b|\bemv\b/],
  ["ATM / POS", /\batm\b|\bpos\b/],
  ["WordPress", /\bwordpress\b/],
  ["n8n / Workflow automation", /\bn8n\b|\bworkflow automation\b|\brpa\b/],
  ["Reporting and automation", /\breporting\b|\bautomation\b/],
];

export function detectSkills(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  return SKILL_DICTIONARY.filter(([, re]) => re.test(lower)).map(([name]) => name);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|\n+|•|•|·/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(value: string | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function yearsToNumber(value: string): number | null {
  const v = value.toLowerCase();
  return WORD_NUMBERS[v] ?? num(v);
}

export function extractCgpa(text: string): number | null {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:cgpa|gpa)\s*(?:of\s*)?(?:minimum\s*|at least\s*|min\.?\s*)?(\d\.\d{1,2})\s*(?:\(?\s*(?:out of|on a scale of|in a scale of|\/)\s*4(?:\.0{1,2})?\)?)/,
    /(?:minimum|min\.?|at least)\s*(?:cgpa|gpa)\s*(?:of\s*)?(\d\.\d{1,2})/,
    /(?:cgpa|gpa)\s*(?:of\s*)?(\d\.\d{1,2})\s*(?:or above|or higher|and above|\+)/,
    /(\d\.\d{1,2})\s*(?:out of|\/)\s*4(?:\.0{1,2})?\b/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    const value = num(m?.[1]);
    if (value != null && value > 1.5 && value <= 4) return value;
  }
  return null;
}

function extractSscHsc(text: string): { minSsc: number | null; minHsc: number | null; note: string | null } {
  for (const s of sentences(text)) {
    const lower = s.toLowerCase();
    if (!/\b(ssc|hsc|secondary|higher secondary)\b/.test(lower)) continue;
    const gpa = lower.match(/gpa\s*(?:of\s*)?(?:minimum\s*)?(\d\.\d{1,2})(?:\s*(?:out of|\/)\s*5)?/) ?? lower.match(/(\d\.\d{1,2})\s*(?:out of|\/)\s*5/);
    const value = num(gpa?.[1]);
    if (value != null && value <= 5) {
      const both = /\b(both|each|ssc and hsc|ssc & hsc|ssc\/hsc)\b/.test(lower) || (/\bssc\b/.test(lower) && /\bhsc\b/.test(lower));
      const ssc = both || /\bssc\b|\bsecondary\b/.test(lower) ? value : null;
      const hsc = both || /\bhsc\b|\bhigher secondary\b/.test(lower) ? value : null;
      return { minSsc: ssc, minHsc: hsc, note: s.slice(0, 200) };
    }
  }
  return { minSsc: null, minHsc: null, note: null };
}

function extractMasters(text: string): boolean | null {
  const lower = text.toLowerCase();
  if (/master'?s?\b[^.;\n]{0,80}\b(not|isn't|is not)\s+(mandatory|required|compulsory|necessary)\b/.test(lower)) return false;
  if (/master'?s?\b[^.;\n]{0,80}\b(mandatory|is required|are required|must|compulsory)\b/.test(lower)) return true;
  if (/\b(must have|mandatory|required)\b[^.;\n]{0,40}\bmaster'?s?\b/.test(lower)) return true;
  if (/master'?s?\b[^.;\n]{0,80}\b(preferred|added advantage|advantage|desirable|will be a plus)\b/.test(lower)) return false;
  if (/\bbachelor'?s?\b[^.;\n]{0,40}\bor\b[^.;\n]{0,20}\bmaster/.test(lower)) return false;
  if (/\b(bachelor|b\.?sc|bba|graduat(e|ion)|4[- ]year)/.test(lower)) return false;
  return null;
}

function extractThirdDivision(text: string): boolean | null {
  const lower = text.toLowerCase();
  if (/\bno\s+(third|3rd)\s+(division|class)\b/.test(lower)) return true;
  if (/\b(third|3rd)\s+(division|class)[^.;\n]{0,50}\b(not|won't|will not|shall not)\b[^.;\n]{0,20}\b(accepted|allowed|eligible|considered)\b/.test(lower)) return true;
  if (/\bnot\s+(have|obtained)\s+(any\s+)?(third|3rd)\s+(division|class)\b/.test(lower)) return true;
  return null;
}

function extractExperience(text: string): { min: number | null; max: number | null } {
  const lower = text.toLowerCase().replace(/–|—/g, "-");
  if (/\b(freshers?|fresh graduates?)\b[^.;\n]{0,40}\b(apply|encouraged|welcome|eligible)\b|\bno (prior )?experience (is )?required\b/.test(lower)) {
    const withRange = lower.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*years?/);
    return { min: 0, max: withRange ? num(withRange[2]) : null };
  }
  for (const s of sentences(lower)) {
    if (!/experience/.test(s)) continue;
    const range = s.match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\+\s*)?(?:-|to)\s*(\d{1,2})\s*years?/);
    if (range) return { min: yearsToNumber(range[1]), max: num(range[2]) };
    const min =
      s.match(/(?:minimum|min\.?|at least|not less than)\s*(?:of\s*)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\(\d+\)\s*)?\+?\s*years?/) ??
      s.match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\(\d+\)\s*)?\+?\s*(?:or more\s*)?years?'?\s*(?:of\s*)?(?:relevant\s*|professional\s*|working\s*|hands-on\s*|practical\s*|job\s*)*experience/);
    if (min) return { min: yearsToNumber(min[1]), max: null };
  }
  return { min: null, max: null };
}

function extractAge(text: string): number | null {
  const lower = text.toLowerCase();
  const patterns = [
    /age[^.;\n]{0,50}?(?:not\s*(?:be\s*)?(?:more|exceed(?:ing)?|over|above)\s*(?:than\s*)?|maximum\s*(?:of\s*)?|max\.?\s*|below\s*|within\s*|up\s*to\s*|limit\s*[:\-]?\s*)(\d{2})\s*(?:years?)?/,
    /(\d{2})\s*years?\s*(?:\(maximum\)|maximum|max\.?)[^.;\n]{0,20}\bage\b/,
    /age\s*[:\-]\s*(?:maximum\s*)?(\d{2})\s*years?/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    const value = num(m?.[1]);
    if (value != null && value >= 18 && value <= 65) return value;
  }
  return null;
}

function extractDisciplines(text: string): { codes: string[]; note: string | null } {
  const eduSentences = sentences(text).filter((s) =>
    /\b(degree|bachelor|b\.?sc|masters?|graduat|discipline|education|academic|cse|eee|computer science)\b/i.test(s),
  );
  const scope = eduSentences.length ? eduSentences.join(" \n ") : "";
  const lower = ` ${scope.toLowerCase()} `;
  const codes = DISCIPLINES.filter(([, re]) => re.test(lower)).map(([code]) => code);
  const related = /\b(or )?(related|relevant|equivalent) (discipline|field|subject)s?\b/.test(lower);
  if (related && codes.length) codes.push("RELATED");
  return { codes: unique(codes), note: eduSentences[0]?.slice(0, 240) ?? null };
}

function extractVacancies(text: string): number | null {
  const m = text.toLowerCase().match(/(?:no\.?\s*of\s*vacanc(?:y|ies)|number\s*of\s*(?:vacanc(?:y|ies)|posts?)|vacanc(?:y|ies))\s*[:\-]?\s*(\d{1,3})\b/);
  return num(m?.[1]);
}

function extractSalary(text: string): string | null {
  const m = text.match(/salary(?:\s*range)?\s*[:\-]\s*([^\n.;]{3,80})/i);
  return m ? m[1].trim() : null;
}

function extractDeadline(text: string): Date | null {
  const m =
    text.match(/(?:application\s*)?deadline\s*[:\-]?\s*([^\n;]{6,40})/i) ??
    text.match(/last date\s*(?:of|for)?\s*(?:submission|application|applying)?[^\d\w]{0,10}([^\n;]{6,40})/i) ??
    text.match(/apply\s*(?:by|before|within)\s*([^\n;]{6,40})/i);
  return m ? parseDhakaDate(m[1]) : null;
}

function extractLocation(text: string): string | null {
  const lower = text.toLowerCase();
  if (/anywhere in bangladesh/.test(lower)) return "Anywhere in Bangladesh";
  const cities = ["Dhaka", "Chattogram", "Chittagong", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Mymensingh", "Gazipur", "Narayanganj"];
  const found = cities.filter((c) => lower.includes(c.toLowerCase()));
  return found.length ? unique(found.map((c) => (c === "Chittagong" ? "Chattogram" : c))).join(", ") : null;
}

function extractWorkMode(text: string): WorkMode | null {
  const lower = text.toLowerCase();
  if (/\bhybrid\b/.test(lower)) return "HYBRID";
  if (/\b(fully remote|remote work|work from home|remote position|remote\))\b/.test(lower)) return "REMOTE";
  if (/\b(on-?site|work from office)\b/.test(lower)) return "ONSITE";
  return null;
}

function splitSkills(text: string): { required: string[]; preferred: string[] } {
  const required = new Set<string>();
  const preferred = new Set<string>();
  for (const s of sentences(text)) {
    const skills = detectSkills(s);
    if (!skills.length) continue;
    const target = /\b(preferred|advantage|plus|desirable|nice to have|good to have)\b/i.test(s) ? preferred : required;
    for (const skill of skills) target.add(skill);
  }
  for (const s of preferred) if (required.has(s)) preferred.delete(s);
  // "Reporting and automation" is too generic to be a hard requirement.
  required.delete("Reporting and automation");
  return { required: [...required], preferred: [...preferred] };
}

export function extractRequirements(text: string): ExtractedRequirements {
  const clean = text.replace(/\r/g, "");
  const disciplines = extractDisciplines(clean);
  const sscHsc = extractSscHsc(clean);
  const experience = extractExperience(clean);
  const skills = splitSkills(clean);
  const result: ExtractedRequirements = {
    educationDisciplines: disciplines.codes,
    disciplineNote: disciplines.note,
    minCgpa: extractCgpa(clean),
    minSscGpa: sscHsc.minSsc,
    minHscGpa: sscHsc.minHsc,
    sscHscRequirement: sscHsc.note,
    mastersRequired: extractMasters(clean),
    noThirdDivision: extractThirdDivision(clean),
    minExperienceYears: experience.min,
    maxExperienceYears: experience.max,
    ageLimit: extractAge(clean),
    bankingExperiencePreferred:
      /\bbanking experience\b[^.;\n]{0,40}\b(preferred|advantage|desirable)\b|\bexperience in (a |the )?(bank|banking|financial institution)[^.;\n]{0,60}\b(preferred|advantage|desirable)\b/i.test(clean),
    requiredSkills: skills.required,
    preferredSkills: skills.preferred,
    vacancies: extractVacancies(clean),
    salary: extractSalary(clean),
    deadline: extractDeadline(clean),
    location: extractLocation(clean),
    workMode: extractWorkMode(clean),
    requirementsParsed: false,
  };
  result.requirementsParsed =
    result.educationDisciplines.length > 0 ||
    result.minCgpa != null ||
    result.mastersRequired != null ||
    result.minExperienceYears != null ||
    result.ageLimit != null ||
    result.noThirdDivision != null;
  return result;
}
