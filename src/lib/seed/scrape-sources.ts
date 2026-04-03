export interface ScrapeSeed {
  regulation_title: string;
  url: string;
  source_name: string;
  scrape_type: "full_page" | "section" | "pdf";
}

export const SCRAPE_SOURCES: ScrapeSeed[] = [
  // Priority 1: Enacted EU legislation (EUR-Lex)
  {
    regulation_title: "EU Artificial Intelligence Act (Regulation 2024/1689)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
    source_name: "EUR-Lex",
    scrape_type: "full_page",
  },
  {
    regulation_title: "EU General Data Protection Regulation (GDPR) — AI Provisions",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679",
    source_name: "EUR-Lex",
    scrape_type: "full_page",
  },
  {
    regulation_title: "EU Digital Operational Resilience Act (DORA)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554",
    source_name: "EUR-Lex",
    scrape_type: "full_page",
  },
  {
    regulation_title: "EU Product Liability Directive Revision (Directive 2024/2853) — AI Provisions",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L2853",
    source_name: "EUR-Lex",
    scrape_type: "full_page",
  },

  // Priority 2: Enacted US state legislation
  {
    regulation_title: "Colorado AI Act (SB 24-205)",
    url: "https://leg.colorado.gov/bills/sb24-205",
    source_name: "Colorado General Assembly",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Texas Responsible AI Governance Act (TRAIGA, HB 149)",
    url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB149",
    source_name: "Texas Legislature",
    scrape_type: "full_page",
  },
  {
    regulation_title: "California AI Transparency Act (SB 942) and AI Watermarking Requirements (AB 853)",
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB942",
    source_name: "California Legislature",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Connecticut AI Act (SB 2, Public Act 24-148)",
    url: "https://www.cga.ct.gov/asp/cgabillstatus/cgabillstatus.asp?selBillType=Bill&which_year=2024&bill_num=2",
    source_name: "Connecticut General Assembly",
    scrape_type: "full_page",
  },
  {
    regulation_title: "New York City Local Law 144 — Automated Employment Decision Tools (AEDT)",
    url: "https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page",
    source_name: "NYC DCWP",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Illinois AI Video Interview Act (AIVI) and Biometric Information Privacy Act (BIPA)",
    url: "https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004",
    source_name: "Illinois General Assembly",
    scrape_type: "full_page",
  },

  // Priority 3: US federal frameworks and guidance
  {
    regulation_title: "NIST AI Risk Management Framework (AI RMF 1.0)",
    url: "https://www.nist.gov/artificial-intelligence/executive-order-safe-secure-and-trustworthy-artificial-intelligence",
    source_name: "NIST",
    scrape_type: "full_page",
  },
  {
    regulation_title: "FDA AI/ML-Based Software as Medical Device (SaMD) Framework",
    url: "https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices",
    source_name: "FDA",
    scrape_type: "full_page",
  },
  {
    regulation_title: "HIPAA and AI — HHS Guidance on Use of AI with Protected Health Information",
    url: "https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/index.html",
    source_name: "HHS",
    scrape_type: "full_page",
  },
  {
    regulation_title: "FTC Enforcement Actions on AI — Section 5 Authority",
    url: "https://www.ftc.gov/business-guidance/blog/2023/02/keep-your-ai-claims-check",
    source_name: "FTC",
    scrape_type: "full_page",
  },

  // Priority 4: International
  {
    regulation_title: "Singapore Model AI Governance Framework for Generative AI and Agentic AI Systems",
    url: "https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2025/ai-governance-framework-for-agentic-ai",
    source_name: "IMDA Singapore",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Brazil AI Bill (PL 2338/2023)",
    url: "https://www.camara.leg.br/propostas-legislativas/2338",
    source_name: "Brazilian Chamber of Deputies",
    scrape_type: "full_page",
  },
  {
    regulation_title: "South Korea AI Basic Act (AI Industry Promotion and Trust Framework Act)",
    url: "https://www.law.go.kr/LSW/eng/engMain.do",
    source_name: "Korean Law Information Center",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Japan AI Guidelines for Business (METI)",
    url: "https://www.meti.go.jp/english/policy/economy/ai_governance/index.html",
    source_name: "METI Japan",
    scrape_type: "full_page",
  },
  {
    regulation_title: "UK Pro-Innovation AI Regulation — Sectoral Approach and Forthcoming AI Bill",
    url: "https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach",
    source_name: "UK Government",
    scrape_type: "full_page",
  },
  {
    regulation_title: "Canada Artificial Intelligence and Data Act (AIDA, Bill C-27)",
    url: "https://www.parl.ca/legisinfo/en/bill/44-1/c-27",
    source_name: "Parliament of Canada",
    scrape_type: "full_page",
  },
];
