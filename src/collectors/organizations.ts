import type { OrgType } from "@/generated/prisma/enums";

export interface OrganizationDefinition {
  slug: string;
  name: string;
  shortName?: string;
  type: OrgType;
  website?: string;
  careersUrl?: string;
  /** Extra names used to resolve employers found on multi-employer portals. */
  aliases?: string[];
}

export const ORGANIZATIONS: OrganizationDefinition[] = [
  // Regulator, recruitment bodies and state-owned banks
  { slug: "bangladesh-bank", name: "Bangladesh Bank", shortName: "BB", type: "GOVERNMENT", website: "https://www.bb.org.bd", careersUrl: "https://erecruitment.bb.org.bd/" },
  { slug: "bscs", name: "Bankers' Selection Committee Secretariat", shortName: "BSCS", type: "GOVERNMENT", website: "https://erecruitment.bb.org.bd/", aliases: ["bankers selection committee", "bscs"] },
  { slug: "sonali-bank", name: "Sonali Bank PLC", shortName: "Sonali", type: "PUBLIC_BANK", website: "https://www.sonalibank.com.bd" },
  { slug: "janata-bank", name: "Janata Bank PLC", shortName: "Janata", type: "PUBLIC_BANK", website: "https://www.jb.com.bd" },
  { slug: "agrani-bank", name: "Agrani Bank PLC", shortName: "Agrani", type: "PUBLIC_BANK", website: "https://www.agranibank.org" },
  { slug: "rupali-bank", name: "Rupali Bank PLC", shortName: "Rupali", type: "PUBLIC_BANK", website: "https://www.rupalibank.com.bd" },
  { slug: "bdbl", name: "Bangladesh Development Bank PLC", shortName: "BDBL", type: "PUBLIC_BANK", website: "https://www.bdbl.com.bd" },
  { slug: "bkb", name: "Bangladesh Krishi Bank", shortName: "BKB", type: "PUBLIC_BANK", website: "https://www.krishibank.org.bd" },
  { slug: "government-other", name: "Government organisations (various)", shortName: "Govt.", type: "GOVERNMENT" },

  // Private commercial banks
  { slug: "dbbl", name: "Dutch-Bangla Bank PLC", shortName: "DBBL", type: "PRIVATE_BANK", website: "https://www.dutchbanglabank.com", aliases: ["dutch bangla", "rocket"] },
  { slug: "city-bank", name: "The City Bank PLC", shortName: "City Bank", type: "PRIVATE_BANK", website: "https://www.citybankplc.com", careersUrl: "https://www.citybankplc.com/p/careers" },
  { slug: "brac-bank", name: "BRAC Bank PLC", shortName: "BRAC Bank", type: "PRIVATE_BANK", website: "https://www.bracbank.com", careersUrl: "https://www.bracbank.com/en/career" },
  { slug: "ebl", name: "Eastern Bank PLC", shortName: "EBL", type: "PRIVATE_BANK", website: "https://www.ebl.com.bd", careersUrl: "https://www.ebl.com.bd/career" },
  { slug: "bank-asia", name: "Bank Asia PLC", shortName: "Bank Asia", type: "PRIVATE_BANK", website: "https://www.bankasia-bd.com" },
  { slug: "mtb", name: "Mutual Trust Bank PLC", shortName: "MTB", type: "PRIVATE_BANK", website: "https://www.mutualtrustbank.com", careersUrl: "https://www.mutualtrustbank.com/about-us/career/" },
  { slug: "ucb", name: "United Commercial Bank PLC", shortName: "UCB", type: "PRIVATE_BANK", website: "https://www.ucb.com.bd" },
  { slug: "ific", name: "IFIC Bank PLC", shortName: "IFIC", type: "PRIVATE_BANK", website: "https://www.ificbank.com.bd" },
  { slug: "trust-bank", name: "Trust Bank PLC", shortName: "Trust Bank", type: "PRIVATE_BANK", website: "https://www.tblbd.com" },
  { slug: "pubali-bank", name: "Pubali Bank PLC", shortName: "Pubali", type: "PRIVATE_BANK", website: "https://www.pubalibangla.com" },
  { slug: "prime-bank", name: "Prime Bank PLC", shortName: "Prime Bank", type: "PRIVATE_BANK", website: "https://www.primebank.com.bd" },
  { slug: "southeast-bank", name: "Southeast Bank PLC", shortName: "SEBL", type: "PRIVATE_BANK", website: "https://www.southeastbank.com.bd" },
  { slug: "standard-bank", name: "Standard Bank PLC", shortName: "Standard Bank", type: "PRIVATE_BANK", website: "https://www.standardbankbd.com" },
  { slug: "sjibl", name: "Shahjalal Islami Bank PLC", shortName: "SJIBL", type: "PRIVATE_BANK", website: "https://www.sjiblbd.com" },
  { slug: "ibbl", name: "Islami Bank Bangladesh PLC", shortName: "IBBL", type: "PRIVATE_BANK", website: "https://www.islamibankbd.com", careersUrl: "https://career.islamibankbd.com/" },
  { slug: "nrb-bank", name: "NRB Bank PLC", shortName: "NRB Bank", type: "PRIVATE_BANK", website: "https://nrbbankbd.com", careersUrl: "https://nrbbankbd.com/career/" },
  { slug: "nrbc-bank", name: "NRBC Bank PLC", shortName: "NRBC", type: "PRIVATE_BANK", website: "https://www.nrbcommercialbank.com" },
  { slug: "community-bank", name: "Community Bank Bangladesh PLC", shortName: "Community Bank", type: "PRIVATE_BANK", website: "https://www.cbbl.com.bd" },
  { slug: "shimanto-bank", name: "Shimanto Bank PLC", shortName: "Shimanto", type: "PRIVATE_BANK", website: "https://www.shimantobank.com" },
  { slug: "bcbl", name: "Bengal Commercial Bank PLC", shortName: "BCBL", type: "PRIVATE_BANK", website: "https://www.bcblbd.com", careersUrl: "https://www.bcblbd.com/career" },

  // Foreign banks
  { slug: "scb", name: "Standard Chartered Bangladesh", shortName: "SCB", type: "FOREIGN_BANK", website: "https://www.sc.com/bd/" },
  { slug: "hsbc", name: "HSBC Bangladesh", shortName: "HSBC", type: "FOREIGN_BANK", website: "https://www.about.hsbc.com.bd" },

  // NBFIs and merchant banks
  { slug: "idlc", name: "IDLC Finance PLC", shortName: "IDLC", type: "NBFI", website: "https://idlc.com", careersUrl: "https://apps.idlc.com/career" },
  { slug: "ipdc", name: "IPDC Finance PLC", shortName: "IPDC", type: "NBFI", website: "https://www.ipdcbd.com" },
  { slug: "lankabangla", name: "LankaBangla Finance PLC", shortName: "LankaBangla", type: "NBFI", website: "https://www.lankabangla.com" },

  // Fintech, MFS and bank-owned payment companies
  { slug: "bkash", name: "bKash Limited", shortName: "bKash", type: "FINTECH", website: "https://www.bkash.com" },
  { slug: "nagad", name: "Nagad Limited", shortName: "Nagad", type: "FINTECH", website: "https://nagad.com.bd" },
  { slug: "upay", name: "UCB Fintech Company Limited (upay)", shortName: "upay", type: "FINTECH", website: "https://www.upaybd.com" },
  { slug: "itcl", name: "IT Consultants PLC (Q-Cash)", shortName: "ITCL", type: "FINTECH", website: "https://www.itcbd.com" },
  { slug: "sslcommerz", name: "SSL Wireless / SSLCOMMERZ", shortName: "SSLCOMMERZ", type: "FINTECH", website: "https://www.sslcommerz.com" },
];

export function findOrganizationByName(name: string | null | undefined): OrganizationDefinition | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return ORGANIZATIONS.find((o) => {
    const candidates = [o.name, o.shortName, ...(o.aliases ?? [])].filter(Boolean).map((c) =>
      c!.toLowerCase().replace(/\b(plc|limited|ltd)\b/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(),
    );
    return candidates.some((c) => c.length >= 3 && (n === c || n.includes(c)));
  });
}
