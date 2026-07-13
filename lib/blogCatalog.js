// Machine-readable catalogue of the site's blog / Knowledge Hub articles.
// Consumed by the AI tools (Meeting Room, GAAP Compare, Interview Coach) so they can
// point users to the most relevant in-house article as a real clickable hyperlink.
// Keep entries terse — the whole catalogue is injected into every relevant system prompt.
const BASE = 'https://uqconsulting.org/blog/';

export const BLOG_ARTICLES = [
  // IFRS 16 — Leases
  { file: 'ifrs-16-lease-accounting-complete-guide.html', title: 'Complete Guide to Lease Accounting (IFRS 16)', topics: ['ifrs 16', 'leases', 'right-of-use asset', 'lease liability'] },
  { file: 'ifrs-16-discount-rate-ibr.html', title: 'Incremental Borrowing Rate (IBR) for Leases', topics: ['ifrs 16', 'discount rate', 'incremental borrowing rate', 'ibr'] },
  { file: 'ifrs-16-lease-modifications.html', title: 'Lease Modifications under IFRS 16', topics: ['ifrs 16', 'lease modification', 'remeasurement'] },
  { file: 'ifrs-16-journal-entries.html', title: 'IFRS 16 Journal Entries & Examples', topics: ['ifrs 16', 'journal entries', 'lease accounting example'] },
  { file: 'ifrs-16-sale-leaseback.html', title: 'Sale-and-Leaseback Transactions (IFRS 16)', topics: ['ifrs 16', 'sale and leaseback', 'sale-leaseback'] },
  { file: 'ifrs-16-short-term-low-value.html', title: 'Short-Term & Low-Value Lease Exemptions', topics: ['ifrs 16', 'short-term lease', 'low-value lease', 'exemptions'] },
  // IFRS 9 — Financial Instruments
  { file: 'ifrs-9-financial-instruments-complete-guide.html', title: 'Complete Guide to Financial Instruments (IFRS 9)', topics: ['ifrs 9', 'financial instruments', 'classification', 'impairment'] },
  { file: 'ifrs-9-expected-credit-loss-model.html', title: 'Expected Credit Loss (ECL) Model', topics: ['ifrs 9', 'ecl', 'expected credit loss', 'staging', 'pd lgd ead'] },
  { file: 'ifrs-9-classification-measurement.html', title: 'IFRS 9 Classification & Measurement', topics: ['ifrs 9', 'classification', 'measurement', 'sppi', 'business model'] },
  { file: 'ifrs-9-hedge-accounting.html', title: 'Hedge Accounting under IFRS 9', topics: ['ifrs 9', 'hedge accounting', 'hedging', 'derivatives'] },
  { file: 'ifrs-9-impairment-accounting.html', title: 'IFRS 9 Impairment Accounting', topics: ['ifrs 9', 'impairment', 'provision matrix', 'credit risk'] },
  { file: 'ifrs-9-modification-derecognition.html', title: 'Modification & Derecognition (IFRS 9)', topics: ['ifrs 9', 'modification', 'derecognition', 'financial liabilities'] },
  // IFRS 15 — Revenue
  { file: 'ifrs-15-revenue-recognition-complete-guide.html', title: 'Complete Guide to Revenue Recognition (IFRS 15)', topics: ['ifrs 15', 'revenue recognition', 'five-step model'] },
  { file: 'ifrs-15-performance-obligations.html', title: 'Performance Obligations (IFRS 15)', topics: ['ifrs 15', 'performance obligations', 'distinct goods'] },
  { file: 'ifrs-15-variable-consideration.html', title: 'Variable Consideration (IFRS 15)', topics: ['ifrs 15', 'variable consideration', 'transaction price', 'constraint'] },
  { file: 'ifrs-15-contract-assets-liabilities.html', title: 'Contract Assets & Liabilities (IFRS 15)', topics: ['ifrs 15', 'contract asset', 'contract liability', 'deferred revenue'] },
  { file: 'ifrs-15-over-time-vs-point-in-time.html', title: 'Over-Time vs Point-in-Time Revenue', topics: ['ifrs 15', 'over time', 'point in time', 'control transfer'] },
  // IAS 36 — Impairment
  { file: 'ias-36-impairment-of-assets-complete-guide.html', title: 'Complete Guide to Asset Impairment (IAS 36)', topics: ['ias 36', 'impairment', 'recoverable amount', 'goodwill'] },
  { file: 'ias-36-cgu-identification.html', title: 'CGU Identification & Goodwill Allocation', topics: ['ias 36', 'cash generating unit', 'cgu', 'goodwill allocation'] },
  { file: 'ias-36-value-in-use-calculation.html', title: 'Value-in-Use Calculation (WACC)', topics: ['ias 36', 'value in use', 'wacc', 'discounted cash flow'] },
  // IAS 37 — Provisions
  { file: 'ias-37-provisions-contingencies-complete-guide.html', title: 'Complete Guide to Provisions & Contingencies (IAS 37)', topics: ['ias 37', 'provisions', 'contingent liabilities', 'onerous contracts'] },
  // IFRS 18 — Presentation
  { file: 'ifrs-18-presentation-of-financial-statements-complete-guide.html', title: 'Complete Guide to Financial Statement Presentation (IFRS 18)', topics: ['ifrs 18', 'presentation', 'primary financial statements', 'mpm'] },
  // IFRS 3 — Business Combinations
  { file: 'ifrs-3-business-combinations-complete-guide.html', title: 'Complete Guide to Business Combinations (IFRS 3)', topics: ['ifrs 3', 'business combinations', 'acquisition method', 'goodwill'] },
  { file: 'ifrs-3-purchase-price-allocation-ppa.html', title: 'Purchase Price Allocation (PPA)', topics: ['ifrs 3', 'ppa', 'purchase price allocation', 'intangibles'] },
  { file: 'ifrs-3-fair-value-measurement.html', title: 'Fair Value Measurement of Intangibles', topics: ['ifrs 3', 'ifrs 13', 'fair value', 'intangible assets'] },
  { file: 'ifrs-3-contingent-consideration.html', title: 'Contingent Consideration (Earnouts)', topics: ['ifrs 3', 'contingent consideration', 'earnout'] },
  { file: 'ifrs-3-reverse-acquisitions.html', title: 'Reverse Acquisitions', topics: ['ifrs 3', 'reverse acquisition', 'accounting acquirer'] },
  { file: 'ifrs-3-step-acquisitions.html', title: 'Step Acquisitions', topics: ['ifrs 3', 'step acquisition', 'business combination achieved in stages'] },
  // IAS 12 — Deferred Tax
  { file: 'ias-12-deferred-tax-complete-guide.html', title: 'Complete Guide to Deferred Tax (IAS 12)', topics: ['ias 12', 'deferred tax', 'temporary differences'] },
  { file: 'ias-12-tax-loss-carryforwards.html', title: 'Tax Loss Carryforwards', topics: ['ias 12', 'tax losses', 'carryforward', 'deferred tax asset'] },
  { file: 'ias-12-valuation-allowances.html', title: 'Valuation Allowances (Deferred Tax Assets)', topics: ['ias 12', 'valuation allowance', 'recoverability', 'deferred tax asset'] },
  { file: 'ias-12-tax-rate-changes.html', title: 'Tax Rate Changes & Deferred Tax', topics: ['ias 12', 'tax rate change', 'substantively enacted'] },
  { file: 'ias-12-deferred-tax-sorie.html', title: 'Deferred Tax on OCI Items (SORIE)', topics: ['ias 12', 'oci', 'sorie', 'deferred tax'] },
  { file: 'ias-12-acquisition-deferred-tax.html', title: 'Acquisition Deferred Tax (Fair Value Step-Ups)', topics: ['ias 12', 'ifrs 3', 'acquisition', 'fair value step-up', 'deferred tax'] },
  // FRS 102 — UK GAAP
  { file: 'frs-102-uk-gaap-complete-guide.html', title: 'Complete Guide to FRS 102 (UK GAAP)', topics: ['frs 102', 'uk gaap', 'frc'] },
  { file: 'frs-102-small-entities-exemptions.html', title: 'FRS 102 Small Entities Exemptions', topics: ['frs 102', 'frs 105', 'small entities', 'section 1a'] },
  { file: 'frs-102-transition-from-ifrs.html', title: 'Transition from IFRS to FRS 102', topics: ['frs 102', 'transition', 'ifrs to uk gaap'] },
  { file: 'frs-102-financial-instruments.html', title: 'FRS 102 Financial Instruments (3-Category Model)', topics: ['frs 102', 'financial instruments', 'basic financial instruments'] },
  // Careers, CV & Interviews
  { file: 'accountant-cv-writing-guide.html', title: 'Accountant CV Writing Guide', topics: ['cv', 'resume', 'accountant cv', 'job application'] },
  { file: 'accounting-interview-technical-questions.html', title: 'Accounting Interview Technical Questions', topics: ['interview', 'technical questions', 'accounting interview'] },
  { file: 'acca-interview-questions-answers.html', title: 'ACCA Interview Questions & Answers', topics: ['interview', 'acca', 'interview questions'] },
  // IFRS vs US GAAP
  { file: 'ifrs-vs-us-gaap-comparison.html', title: 'IFRS vs US GAAP: Complete Comparison', topics: ['ifrs vs us gaap', 'us gaap', 'comparison', 'jurisdiction'] },
  { file: 'lease-accounting-ifrs-16-vs-asc-842-deep-dive.html', title: 'Lease Accounting: IFRS 16 vs ASC 842', topics: ['ifrs 16', 'asc 842', 'leases', 'us gaap'] },
  { file: 'revenue-recognition-ifrs-15-vs-asc-606-deep-dive.html', title: 'Revenue Recognition: IFRS 15 vs ASC 606', topics: ['ifrs 15', 'asc 606', 'revenue', 'us gaap'] },
  { file: 'financial-instruments-ifrs-9-vs-asc-320-321-deep-dive.html', title: 'Financial Instruments: IFRS 9 vs ASC 320/321', topics: ['ifrs 9', 'asc 320', 'asc 321', 'us gaap'] },
  { file: 'goodwill-impairment-ias-36-vs-asc-350-deep-dive.html', title: 'Goodwill Impairment: IAS 36 vs ASC 350', topics: ['ias 36', 'asc 350', 'goodwill impairment', 'us gaap'] },
  { file: 'provisions-contingencies-ias-37-vs-asc-450-deep-dive.html', title: 'Provisions: IAS 37 vs ASC 450', topics: ['ias 37', 'asc 450', 'provisions', 'us gaap'] },
  { file: 'inventory-valuation-ias-2-vs-asc-330-deep-dive.html', title: 'Inventory Valuation: IAS 2 vs ASC 330', topics: ['ias 2', 'asc 330', 'inventory', 'us gaap'] },
  // Audit
  { file: 'pcaob-standards-audit-quality-guide.html', title: 'PCAOB Standards & Audit Quality Guide', topics: ['pcaob', 'audit quality', 'audit standards'] },
].map(a => ({ ...a, url: BASE + a.file }));

// Compact catalogue string for injection into system prompts.
export function blogCatalogPrompt() {
  const lines = BLOG_ARTICLES.map(a => `- ${a.title} [${a.topics.join(', ')}] -> ${a.url}`).join('\n');
  return `KNOWLEDGE HUB — the website publishes in-house articles the user can read for deeper detail. When a topic under discussion is genuinely covered by one of these, refer the user to the most specific relevant article using a markdown hyperlink to that exact article, e.g. "[Variable Consideration (IFRS 15)](https://uqconsulting.org/blog/ifrs-15-variable-consideration.html)". Only cite an article when it is directly relevant — never force a link, never list several at once, and never invent a URL that is not in this list. Never read a URL aloud; the hyperlink label is what is spoken.\nArticles:\n${lines}`;
}
