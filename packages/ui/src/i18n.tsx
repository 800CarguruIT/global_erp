"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOptionalGlobalUiContext } from "./providers/GlobalUiProvider";

export type LanguageCode =
  | "en"
  | "ar"
  | "es"
  | "fr"
  | "de"
  | "hi"
  | "zh"
  | "ru"
  | "pt"
  | "tr"
  | "ja"
  | "ko"
  | "it"
  | "nl"
  | "sv"
  | "pl"
  | "id"
  | "vi"
  | "th"
  | "he";

export type Language = {
  code: LanguageCode;
  label: string;
  dir: "ltr" | "rtl";
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "Arabic", dir: "rtl" },
  { code: "es", label: "Spanish", dir: "ltr" },
  { code: "fr", label: "French", dir: "ltr" },
  { code: "de", label: "German", dir: "ltr" },
  { code: "hi", label: "Hindi", dir: "ltr" },
  { code: "zh", label: "Chinese", dir: "ltr" },
  { code: "ru", label: "Russian", dir: "ltr" },
  { code: "pt", label: "Portuguese", dir: "ltr" },
  { code: "tr", label: "Turkish", dir: "ltr" },
  { code: "ja", label: "Japanese", dir: "ltr" },
  { code: "ko", label: "Korean", dir: "ltr" },
  { code: "it", label: "Italian", dir: "ltr" },
  { code: "nl", label: "Dutch", dir: "ltr" },
  { code: "sv", label: "Swedish", dir: "ltr" },
  { code: "pl", label: "Polish", dir: "ltr" },
  { code: "id", label: "Indonesian", dir: "ltr" },
  { code: "vi", label: "Vietnamese", dir: "ltr" },
  { code: "th", label: "Thai", dir: "ltr" },
  { code: "he", label: "Hebrew", dir: "rtl" },
];

// 🔑 All UI text lives here in English ONCE.
// These keys will be auto-translated by AI.
export const BASE_MESSAGES: Record<string, string> = {
  "app.badge": "AutoGuru",
  "app.brandLine": "Global ERP • AI Hub",

  "welcome.title": "Welcome to Global ERP AI Hub",
  "welcome.body":
    "This is your control center. From here we will build AI tools for dialers, translations, legal documents, and more — all on one shared system.",

  "translator.title": "AI Translator",
  "translator.description":
    "Type any text and let AutoGuru AI translate it into one of the top global languages. Perfect for WhatsApp, email, and call scripts.",
  "translator.targetLabel": "Target language",
  "translator.buttonIdle": "Translate with AI",
  "translator.buttonLoading": "Translating…",
  "translator.originalLabel": "Original text",
  "translator.translationLabel": "AI translation",
  "translator.placeholder":
    "Type something like: 'Call the customer and confirm their appointment for tomorrow at 3 PM.'",
  "translator.emptyState":
    "Translation will appear here. Choose a language and click “Translate with AI”.",
  "translator.errorGeneric": "Something went wrong talking to AI.",

  "global.nav.overview": "Overview",
  "global.nav.main": "Main",
  "global.nav.companies": "Companies",
  "global.nav.callCenter": "Call Center",
  "global.nav.leads": "Leads",
  "global.nav.marketing": "Marketing",
  "global.nav.chartOfAccounts": "Chart of Accounts",
  "global.nav.finance": "Finance",
  "global.nav.analytics": "Analytics",
  "global.nav.docs": "Documentation",
  "global.nav.reports": "Reports",
  "global.nav.users": "Users",
  "global.nav.roles": "Roles",
  "global.nav.hr": "HR",
  "global.nav.integrations": "Integrations",
  "global.nav.aiHub": "AI Hub",
  "global.nav.aiPanel": "AI Panel",
  "global.nav.monitoring": "Monitoring",
  "global.nav.settings": "Settings",
  "global.nav.profile": "Profile",

  "global.main.title": "Overview",
  "global.main.subtitle": "Choose a module to get started.",
  "global.main.cards.companies.title": "Companies",
  "global.main.cards.companies.description": "Manage companies and branches.",
  "global.main.cards.companies.cta": "Open Companies",
  "global.main.cards.settings.title": "Settings",
  "global.main.cards.settings.description": "Configuration and master data.",
  "global.main.cards.settings.cta": "Open Settings",
  "global.main.progress.label": "Setup progress",
  "global.main.progress.sublabel": "Complete modules to unlock everything",
  "global.hero.title": "Global control center",
  "global.hero.subtitle": "Run global, company, branch, vendor, and staff operations with AI assistance.",
  "global.kpi.activeCompanies": "Active companies",
  "global.kpi.branches": "Active branches",
  "global.kpi.users": "Users online",
  "global.kpi.aiActions": "AI actions today",
  "global.kpi.activeLeads": "Active leads",
  "global.kpi.activeCalls": "Active calls",
  "global.kpi.activeCampaigns": "Active campaigns",
  "global.quickActions.title": "Quick actions",
  "global.quickActions.companies": "Open companies",
  "global.quickActions.settings": "Open settings",
  "global.quickActions.leads": "Open leads",
  "global.quickActions.reports": "View reports",
  "global.modules.title": "Modules",
  "global.data.pending": "Live data not available yet.",
  "global.data.hint": "Connect your data sources or APIs to see real KPIs here.",
  "global.data.loading": "Loading live metrics...",
  "global.data.error": "Failed to load live metrics.",
  "global.aiBox.title": "AI summary",
  "global.aiBox.actions.title": "Recommended actions",
  "global.aiBox.actions.empty": "No urgent actions detected.",
  "global.aiBox.appreciation.title": "Win to celebrate",
  "global.aiBox.appreciation.fallback": "We recently onboarded companies — keep going!",
  "global.aiBox.action.noLeads": "Capture new leads or import existing ones to start pipelines.",
  "global.aiBox.action.noCalls": "No calls logged in 24h. Check dialer integrations and call routing.",
  "global.aiBox.action.noCampaigns": "No active campaigns. Launch a campaign to drive inbound/outbound activity.",
  "global.aiBox.action.noCompanies": "No companies onboarded. Create at least one company to enable modules.",
  "global.aiBox.appreciation.calls": "{count} calls logged in the last 24h. Good momentum.",
  "global.aiBox.appreciation.leads": "{count} sales leads captured. Keep nurturing them.",
  "global.aiBox.appreciation.companies": "{count} companies onboarded. Solid foundation.",
  "global.nav.open": "Open",
  "global.aiBox.model.loading": "Asking AI for insights...",
  "global.aiBox.model.error": "AI summary unavailable right now.",

  // Companies list
  "companies.title": "Companies",
  "companies.create": "Create Company",
  "companies.table.displayName": "Display Name",
  "companies.table.legalName": "Legal Name",
  "companies.table.tradeLicense": "Trade License",
  "companies.table.adminLogin": "Admin Login",
  "companies.table.country": "Country",
  "companies.table.owner": "Owner",
  "companies.table.phone": "Phone",
  "companies.table.subscription": "Subscription",
  "companies.table.branches": "Branches",
  "companies.table.vendors": "Vendors",
  "companies.table.customers": "Customers",
  "companies.table.cars": "Cars",
  "companies.table.users": "Users",
  "companies.table.actions": "Actions",
  "companies.table.edit": "Edit",
  "companies.table.delete": "Delete",
  "companies.table.deleting": "Deleting...",
  "companies.table.empty": "No companies yet.",
  "companies.kpi.companies": "Companies",
  "companies.kpi.branches": "Branches",
  "companies.kpi.vendors": "Vendors",
  "companies.kpi.customers": "Customers",
  "companies.kpi.cars": "Cars",
  "companies.kpi.users": "Users",
  "companies.kpi.activeSubs": "Active subs",
  "companies.kpi.inactiveSubs": "Inactive subs",
  "companies.kpi.renewalDue": "Renewal due (7d)",
  "companies.ai.title": "AI assistant",
  "companies.ai.loading": "Analyzing latest data...",
  "companies.ai.actions.empty": "Nothing urgent detected. Keep monitoring.",
  "companies.ai.actions.noCompanies": "Create your first company to unlock modules.",
  "companies.ai.actions.noBranches": "Add branches for each location to route work.",
  "companies.ai.actions.noVendors": "Onboard vendors to start procurement flows.",
  "companies.ai.actions.noCustomers": "Import customers to activate CRM pipelines.",
  "companies.ai.actions.noCars": "Add cars/asset records to link with customers.",
  "companies.ai.actions.noUsers": "Invite admins and staff to manage operations.",
  "companies.ai.appreciation.title": "Win to celebrate",
  "companies.ai.appreciation.customers": "{companies} companies and {customers} customers online. Nice momentum!",
  "companies.ai.appreciation.branches": "{companies} companies with {branches} branches running. Good coverage.",
  "companies.ai.appreciation.companies": "{companies} companies onboarded. Great start.",
  "companies.ai.appreciation.empty": "Once data arrives, I will highlight wins here.",
  "subscriptions.add.title": "Add subscription",
  "subscriptions.add.hint": "Create a subscription entry for this company. Latest entry shows in the list.",
  "subscriptions.add.category": "Category",
  "subscriptions.add.amount": "Amount",
  "subscriptions.add.endsAt": "Ends at (optional)",
  "subscriptions.add.button": "Add subscription",
  "subscriptions.add.success": "Subscription added.",
  "subscriptions.add.error": "Failed to add subscription.",
  "subscriptions.categories.trial": "Trial",
  "subscriptions.categories.active": "Active",
  "subscriptions.categories.expiring": "Expiring",
  "subscriptions.categories.expired": "Expired",
  "subscriptions.categories.offboarded": "Offboarded",
  "subscriptions.plan.free": "Free",

  "companies.invoice.title": "Latest invoice",
  "companies.invoice.subtitle": "Track billing and mark payments to reflect in accounting.",
  "companies.invoice.none": "No invoices yet.",
  "companies.invoice.loading": "Loading invoice...",
  "companies.invoice.amount": "Amount",
  "companies.invoice.status": "Status",
  "companies.invoice.due": "Due date",
  "companies.invoice.paidAt": "Paid at",
  "companies.invoice.reference": "Reference",
  "companies.invoice.markPaid": "Mark paid",
  "companies.invoice.marking": "Marking...",
  "companies.invoice.success": "Invoice updated.",
  "companies.invoice.error": "Failed to update invoice.",
  "companies.loading": "Loading...",
  "companies.delete.confirm": "Delete {name}? This cannot be undone.",
  "companies.delete.error": "Failed to delete company",
  "companies.load.error": "Failed to load companies",

  // Company create/edit page
  "companies.breadcrumb": "Global • Companies",
  "companies.create.title": "Create Company",
  "companies.edit.title": "Edit Company",
  "companies.back": "Back to Companies",
  "companies.save.error": "Failed to save company",
  "companies.save.success": "Saved",
  "companies.save.saving": "Saving...",
  "companies.save.create": "Create Company",
  "companies.save.update": "Update Company",

  // Company form sections
  "companyForm.section.basic": "Basic",
  "companyForm.section.location": "Location & contact",
  "companyForm.section.trade": "Trade License",
  "companyForm.section.tax": "Tax",
  "companyForm.section.owner": "Owner",
  "companyForm.section.contacts": "Contacts",

  // Company form fields
  "companyForm.displayName": "Display name",
  "companyForm.legalName": "Legal name",
  "companyForm.domain": "Domain",
  "companyForm.logo": "Logo",
  "companyForm.country": "Country",
  "companyForm.city": "City",
  "companyForm.stateRegion": "State/Region",
  "companyForm.postalCode": "Postal code",
  "companyForm.timezone": "Timezone",
  "companyForm.currency": "Currency",
  "companyForm.companyPhone": "Company phone",
  "companyForm.companyEmail": "Company email",
  "companyForm.address": "Address",
  "companyForm.address2": "Address line 2",
  "companyForm.address.hint": "Later we will add a Google Maps pin here; for now, enter the address manually.",
  "companyForm.tradeNumber": "Number",
  "companyForm.tradeFile": "Trade license file",
  "companyForm.tradeFile.hint": "Attach the trade license document or paste its file id.",
  "companyForm.issueDate": "Issue date",
  "companyForm.expiryDate": "Expiry date",
  "companyForm.tax.hasVat": "Has VAT",
  "companyForm.tax.hasCorporate": "Has Corporate Tax",
  "companyForm.vatNumber": "VAT Number",
  "companyForm.vatCertificate": "VAT Certificate",
  "companyForm.corporateTaxNumber": "Corporate Tax Number",
  "companyForm.corporateTaxCertificate": "Corporate Tax Certificate",
  "companyForm.ownerName": "Owner name",
  "companyForm.ownerPhone": "Owner phone",
  "companyForm.ownerEmail": "Owner email",
  "companyForm.ownerPassportNumber": "Passport number",
  "companyForm.ownerPassportFile": "Passport file",
  "companyForm.ownerIssue": "Issue date",
  "companyForm.ownerExpiry": "Expiry date",
  "companyForm.ownerAddress": "Owner address",
  "companyForm.contactTitle": "Title",
  "companyForm.contactName": "Name",
  "companyForm.contactPhone": "Phone",
  "companyForm.contactEmail": "Email",
  "companyForm.contactAddress": "Address",
  "companyForm.contact.remove": "Remove",
  "companyForm.contact.add": "Add contact",
  "companyForm.timezone.placeholder": "Auto from country, override if needed",
  "companyForm.currency.placeholder": "Auto from country, override if needed",
  "companyForm.countryFirst": "Select country first",

  // HR
  "hr.title": "HR",
  "hr.subtitle": "Manage employees and users from one place.",
  "hr.card.employees.title": "Employees",
  "hr.card.employees.desc": "View and manage employee records.",
  "hr.card.employees.cta": "Open employees",
  "hr.card.globalUsers.title": "Global users",
  "hr.card.globalUsers.desc": "Manage platform-level accounts and access.",
  "hr.card.globalUsers.cta": "Open global users",
  "hr.card.companyUsers.title": "Company users",
  "hr.card.companyUsers.desc": "Manage users per company for easier ownership.",
  "hr.card.companyUsers.cta": "Pick a company",

  "hr.companyUsers.title": "Company users",
  "hr.companyUsers.subtitle": "Select a company to manage its user accounts.",
  "hr.companyUsers.selectLabel": "Select company",
  "hr.companyUsers.searchPlaceholder": "Search users...",
  "hr.companyUsers.search": "Search",
  "hr.companyUsers.usersTitle": "Users",
  "hr.companyUsers.usersSubtitle": "Manage users for the selected company.",
  "hr.companyUsers.loading": "Loading companies...",
  "hr.companyUsers.error": "Failed to load companies",
  "hr.companyUsers.empty": "No companies found.",
  "hr.companyUsers.manage": "Manage users",
  "hr.companyUsers.required": "Select a company to view users.",

  // HR employees
  "hr.employees.title": "Global employees",
  "hr.employees.new": "+ New employee",
  "hr.employees.loading": "Loading employees...",
  "hr.employees.loadError": "Failed to load employees",
  "hr.employees.deleteError": "Failed to delete employee",
  "hr.employees.table.title": "Employees",
  "hr.employees.table.id": "ID",
  "hr.employees.table.name": "Name",
  "hr.employees.table.title": "Title",
  "hr.employees.table.divisionDept": "Division / Dept",
  "hr.employees.table.type": "Type",
  "hr.employees.table.basic": "Basic",
  "hr.employees.table.allowances": "Allowances",
  "hr.employees.table.govFees": "Gov fees",
  "hr.employees.table.grandTotal": "Grand total",
  "hr.employees.table.edit": "Edit",
  "hr.employees.table.delete": "Delete",
  "hr.employees.table.empty": "No employees yet.",

  // Accounting / Finance
  "accounting.title": "Accounting (global)",
  "accounting.subtitle": "Global ledger overview across all companies.",
  "accounting.select": "Select",
  "accounting.summary.loading": "Loading accounting data...",
  "accounting.summary.loadError": "Failed to load accounting summary",
  "accounting.accounts.loadError": "Failed to load accounts",

  "accounting.reports.label": "Reports",
  "accounting.reports.pnl": "Profit & Loss",
  "accounting.reports.pnl.desc": "View P&L by period",
  "accounting.reports.cashflow": "Cash Flow",
  "accounting.reports.cashflow.desc": "Cash and bank movement",
  "accounting.reports.trial": "Trial Balance",
  "accounting.reports.trial.desc": "Debits, credits, balances",
  "accounting.reports.balance": "Balance Sheet",
  "accounting.reports.balance.desc": "Assets, liabilities, equity",
  "accounting.reports.chart": "Chart of Accounts",
  "accounting.reports.chart.desc": "Accounts, types, mappings",

  "accounting.ledger.title": "Post manual ledger",
  "accounting.ledger.date": "Date",
  "accounting.ledger.description": "Description",
  "accounting.ledger.descriptionPlaceholder": "Payment / adjustment description",
  "accounting.ledger.debitAccount": "Debit account",
  "accounting.ledger.creditAccount": "Credit account",
  "accounting.ledger.amount": "Amount",
  "accounting.ledger.post": "Post entry",
  "accounting.ledger.posting": "Posting...",
  "accounting.ledger.validation": "Debit account, credit account, and amount are required.",
  "accounting.ledger.success": "Ledger entry posted.",
  "accounting.ledger.error": "Failed to post ledger entry",

  "accounting.entries.title": "Latest entries",
  "accounting.entries.date": "Date",
  "accounting.entries.description": "Description",
  "accounting.entries.debit": "Debit",
  "accounting.entries.credit": "Credit",
  "accounting.entries.balance": "Balance",
  "accounting.entries.empty": "No entries yet.",

  // Accounting KPIs and AI
  "accounting.metric.balance": "Balance",
  "accounting.metric.total_debit": "Total debit",
  "accounting.metric.total_credit": "Total credit",
  "accounting.metric.journals": "Journals",
  "accounting.metric.accounts_receivable": "Accounts receivable",
  "accounting.metric.accounts_payable": "Accounts payable",
  "accounting.metric.available_balance": "Available balance",
  "accounting.metric.detail.posted_journals": "Posted journals",

  "accounting.ai.actionsTitle": "AI suggestions",
  "accounting.ai.appreciationTitle": "AI appreciation",
  "accounting.ai.loading": "Thinking...",
  "accounting.ai.empty": "No notes yet.",
  "accounting.ai.error": "AI summary unavailable right now.",

  // Accounting reports page
  "accounting.reports.page.title": "Accounting reports",
  "accounting.reports.page.subtitle":
    "Access P&L, Cashflow, Trial Balance, and Balance Sheet for the global books.",
  "accounting.reports.view": "View report",

  // Cash flow report
  "accounting.cashflow.title": "Cash Flow",
  "accounting.cashflow.subtitle": "Cash and bank movements for the selected period.",
  "accounting.cashflow.apply": "Apply",
  "accounting.cashflow.loading": "Loading cash flow...",
  "accounting.cashflow.error": "Failed to load cash flow",
  "accounting.cashflow.empty": "No data available.",
  "accounting.cashflow.account": "Account",
  "accounting.cashflow.amount": "Amount",

  // P&L
  "accounting.pnl.title": "Profit & Loss",
  "accounting.pnl.subtitle": "Global P&L for the selected period.",
  "accounting.pnl.apply": "Apply",
  "accounting.pnl.loading": "Loading P&L...",
  "accounting.pnl.error": "Failed to load P&L",
  "accounting.pnl.empty": "No data available.",
  "accounting.pnl.account": "Account",
  "accounting.pnl.amount": "Amount",

  // Trial balance
  "accounting.trial.title": "Trial Balance",
  "accounting.trial.subtitle": "As of {date}",
  "accounting.trial.apply": "Apply",
  "accounting.trial.loading": "Loading trial balance...",
  "accounting.trial.error": "Failed to load trial balance",
  "accounting.trial.empty": "No data available.",
  "accounting.trial.account": "Account",
  "accounting.trial.debit": "Debit",
  "accounting.trial.credit": "Credit",
  "accounting.trial.balance": "Balance",

  // Balance sheet
  "accounting.balance.title": "Balance Sheet",
  "accounting.balance.subtitle": "As of {date}",
  "accounting.balance.apply": "Apply",
  "accounting.balance.loading": "Loading balance sheet...",
  "accounting.balance.error": "Failed to load balance sheet",
  "accounting.balance.empty": "No data available.",
  "accounting.balance.account": "Account",
  "accounting.balance.amount": "Amount",

  // Accounting invoices
  "accounting.invoices.title": "Invoices",
  "accounting.invoices.subtitle": "View, open, download, and mark invoices as paid.",
  "accounting.invoices.loading": "Loading invoices...",
  "accounting.invoices.total": "Total invoices",
  "accounting.invoices.paid": "Paid",
  "accounting.invoices.unpaid": "Unpaid",
  "accounting.invoices.reference": "Reference",
  "accounting.invoices.status": "Status",
  "accounting.invoices.amount": "Amount",
  "accounting.invoices.due": "Due",
  "accounting.invoices.paidAt": "Paid",
  "accounting.invoices.actions": "Actions",
  "accounting.invoices.open": "Open",
  "accounting.invoices.empty": "No invoices yet.",
  "accounting.invoices.marked": "Marked as paid.",
  "accounting.invoices.markFailed": "Failed to mark paid",
  "accounting.invoices.statusLabel": "Status:",
  "accounting.invoices.download": "Download / Print",
  "accounting.invoices.marking": "Marking...",
  "accounting.invoices.markPaid": "Mark paid",
  "accounting.invoices.from": "From",
  "accounting.invoices.orgDefault": "Global ERP",
  "accounting.invoices.taxId": "Tax:",
  "accounting.invoices.billTo": "Bill To",
  "accounting.invoices.vat": "Tax / TRN:",
  "accounting.invoices.owner": "Owner:",
  "accounting.invoices.noCompany": "No company details.",
  "accounting.invoices.totalLabel": "Total",
  "accounting.invoices.dueDate": "Due date",
  "accounting.invoices.paidAtLabel": "Paid at",
  "accounting.invoices.referenceLabel": "Reference",
  "accounting.invoices.descriptionLabel": "Description",
  "accounting.invoices.lineNo": "#",
  "accounting.invoices.item": "Item",
  "accounting.invoices.lineDescription": "Description",
  "accounting.invoices.lineAmount": "Amount",
  "accounting.invoices.noLines": "No lines.",

  // Settings
  "settings.title": "Settings",
  "settings.subtitle": "Configure AI, integrations, roles, and your profile.",
  "settings.cards.ai.title": "AI Panel",
  "settings.cards.ai.desc": "Manage AI console, prompts, and assistants.",
  "settings.cards.integrations.title": "Integrations",
  "settings.cards.integrations.desc": "Connect channels, dialers, and monitor health.",
  "settings.cards.roles.title": "Roles",
  "settings.cards.roles.desc": "Manage permissions and access policies.",
  "settings.cards.orgProfile.title": "Global ERP profile",
  "settings.cards.orgProfile.desc": "Set sender information for invoices and documents.",
  "settings.cards.profile.title": "Profile",
  "settings.cards.profile.desc": "Update your personal settings.",
  "settings.cards.profile.back": "Back to settings",
  "settings.cards.open": "Open",
  "settings.cards.integrations.channels": "Channel Integrations",
  "settings.cards.integrations.channels.desc": "Connect WhatsApp, email, and other channels.",
  "settings.cards.integrations.dialer": "Dialer Integrations",
  "settings.cards.integrations.dialer.desc": "Configure dialer providers and test calls.",
  "settings.cards.integrations.status": "Status",
  "settings.cards.integrations.status.desc": "Monitor health and uptime for integrations.",

  "settings.integrations.title": "Integrations",
  "settings.integrations.subtitle": "Manage channels, dialers, and monitor health.",
  "settings.integrations.channels.title": "Global Channel Integrations",
  "settings.integrations.dialer.title": "Global Dialer Integrations",
  "settings.integrations.status.title": "Integration Status",
  "settings.integrations.status.desc": "Status dashboard for global integrations will be added here.",

"settings.ai.title": "WELCOME TO GLOBAL ERP AI HUB",
"settings.ai.subtitle":
  "This is your control center. From here we will build AI tools for dialers, translations, legal documents, and more - all on one shared system.",

"settings.roles.title": "Global Roles",
"settings.roles.createTitle": "Create Global Role",
"settings.roles.editTitle": "Edit Global Role",
"settings.roles.new": "New Role",
"settings.roles.back": "Back to Roles",
"settings.roles.loading": "Loading...",
"settings.roles.error": "Failed to load roles",
  "settings.roles.permsError": "Failed to load permissions",
  "settings.roles.roleError": "Failed to load role",
  "settings.roles.form.step.role": "1. Role",
  "settings.roles.form.step.permissions": "2. Permissions",
  "settings.roles.form.title.role": "Role",
  "settings.roles.form.title.permissions": "Permissions",
  "settings.roles.form.field.name": "Name",
  "settings.roles.form.field.key": "Key",
  "settings.roles.form.field.description": "Description",
  "settings.roles.form.search.placeholder": "Search permissions",
  "settings.roles.form.selected.label": "Selected",
  "settings.roles.form.selectFiltered": "Select filtered",
  "settings.roles.form.clearFiltered": "Clear filtered",
  "settings.roles.form.selectAll": "Select all",
  "settings.roles.form.clearAll": "Clear",
  "settings.roles.form.empty": "No permissions match your search.",
  "settings.roles.form.back": "Back",
  "settings.roles.form.next": "Next",
  "settings.roles.form.save": "Save Role",
  "settings.roles.form.saving": "Saving...",

"settings.org.title": "Global ERP profile",
"settings.org.subtitle": "This information appears as the FROM details on invoices and billing documents.",
"settings.org.name": "Business name",
"settings.org.address": "Address",
"settings.org.email": "Email",
"settings.org.phone": "Phone",
"settings.org.taxId": "Tax ID",
"settings.org.website": "Website",
"settings.org.currency": "Default currency",
"settings.org.save": "Save profile",
"settings.org.saving": "Saving...",
"settings.org.saved": "Profile saved.",
"settings.org.error": "Failed to save profile.",
"settings.org.loading": "Loading profile...",

"settings.users.title": "Global Users",
"settings.users.subtitle": "Manage platform users and assign roles.",
"settings.users.search": "Search users...",
"settings.users.searchBtn": "Search",
"settings.users.loading": "Loading...",
"settings.users.error": "Failed to load users",
"settings.users.createTitle": "Create User",
"settings.users.editTitle": "Edit User",
"settings.users.createError": "Failed to create user",
"settings.users.updateError": "Failed to update user",
"settings.users.rolesError": "Failed to load roles",
"settings.users.missingId": "Missing user id",

"settings.security.monitoring.title": "Security Monitoring",
"settings.security.monitoring.desc": "Sessions and monitoring for the global scope (coming soon).",

  // Call center - main
  "call.main.title": "Global Call Center",
  "call.main.subtitle": "Manage inbound/outbound calls, create leads, and link callers to companies.",
  "call.main.manual.heading": "Manual lookup",
  "call.main.manual.helper": "Phone / Car plate",
  "call.main.manual.placeholder": "Enter phone number or car plate",
  "call.main.manual.button.search": "Search",
  "call.main.manual.button.searching": "Searching...",
  "call.main.manual.error": "Lookup failed",
  "call.main.manual.empty": "No matches found.",
  "call.main.incoming.title": "Incoming",
  "call.main.incoming.helper": "Receive",
  "call.main.incoming.empty": "No incoming calls right now.",
  "call.main.outgoing.title": "Outgoing",
  "call.main.outgoing.helper": "Place call",
  "call.main.outgoing.empty": "No dialers configured. Add one in Settings > Integrations.",
  "call.main.leads.title": "Leads",
  "call.main.leads.helper": "Create / Manage",
  "call.main.leads.create": "Create lead",
  "call.main.leads.manage": "Manage leads",
"call.main.recent.title": "Recent calls",
"call.main.recent.link": "Call history",
"call.main.recent.empty": "No calls yet.",
"call.main.error": "Failed to load call center data.",
"call.main.manual.loading": "Loading call center...",
"call.main.incoming.toLabel": "To:",

// Call center - company specific
"call.company.title": "Call Center",
"call.company.subtitle": "Manage inbound/outbound calls, create leads, and link callers.",
"call.company.loading": "Loading company...",
"call.results.viewCustomer": "View customer",
"call.results.createCustomer": "Create customer",
"call.results.viewCar": "View car",
"call.results.addCar": "Add car",
"call.results.linkCustomer": "Link customer",

// Call center - AI intercept
"call.ai.title": "AI intercept",
"call.ai.subtitle": "Connect to a live call to see transcript and suggestions.",
"call.ai.status": "Status:",
"call.ai.status.live": "Live",
"call.ai.status.connecting": "Connecting...",
"call.ai.status.idle": "Idle",
"call.ai.active": "Active calls",
"call.ai.noActive": "No active calls.",
"call.ai.callIdPlaceholder": "Enter active call ID",
"call.ai.connect": "Connect",
"call.ai.connectHelper": "Select from active list or paste a call ID to monitor in real-time.",
"call.ai.transcript": "Transcript",
"call.ai.waiting": "Waiting for transcript...",
"call.ai.suggestions": "Suggestions",
"call.ai.suggestions.empty": "AI will suggest replies here.",
"call.ai.appreciation": "Appreciation",
"call.ai.appreciation.empty": "AI will note wins here.",

  // Call center - stats
  "call.stats.totalToday": "Total today",
  "call.stats.answered": "Answered",
  "call.stats.missed": "Missed",
  "call.stats.outbound": "Outbound",

  // Call center - history
  "call.history.title": "Call History",
  "call.history.subtitle": "Review inbound and outbound calls with details.",
  "call.history.tab.all": "All",
  "call.history.tab.inbound": "Inbound",
  "call.history.tab.outbound": "Outbound",
  "call.history.loading": "Loading...",
  "call.history.error": "Failed to load call history",
  "call.history.empty": "No calls found.",
  "call.history.table.customer": "Customer",
  "call.history.table.direction": "Direction",
  "call.history.table.from": "From",
  "call.history.table.to": "To",
  "call.history.table.type": "Type",
  "call.history.table.status": "Status",
  "call.history.table.remarks": "Remarks",
  "call.history.table.started": "Started",
  "call.history.table.recording": "Recording",
  "call.history.table.recording.link": "Recording",

  // Call center - dashboard
  "call.dashboard.title": "Global Call Center Dashboard",
  "call.dashboard.refresh": "Refresh",
  "call.dashboard.dateRange": "Date Range",
  "call.dashboard.from": "From",
  "call.dashboard.to": "To",
  "call.dashboard.apply": "Apply",
  "call.dashboard.error": "Failed to load dashboard",
  "call.dashboard.byStatus": "By Status",
  "call.dashboard.byDirection": "By Direction",
  "call.dashboard.byUser": "By User",
  "call.dashboard.byDay": "By Day",

  // Leads list
  "leads.title": "Leads",
  "leads.subtitle": "Track global leads across sales, support, and complaints.",
  "leads.company.title": "Leads",
  "leads.company.subtitle": "Manage company leads across RSA, recovery, and workshop.",
  "leads.create": "Create Lead",
  "leads.scopePrefix": "Company",
  "leads.tab.all": "All",
  "leads.tab.rsa": "RSA",
  "leads.tab.recovery": "Recovery",
  "leads.tab.workshop": "Workshop",
  "leads.tab.open": "Open",
  "leads.tab.assigned": "Assigned",
  "leads.tab.onboarding": "Onboarding",
  "leads.tab.inprocess": "In process",
  "leads.tab.completed": "Completed",
  "leads.tab.closed": "Closed",
  "leads.tab.lost": "Lost",
  "leads.table.lead": "Lead",
  "leads.table.customer": "Customer",
  "leads.table.contact": "Contact",
  "leads.table.type": "Type",
  "leads.table.status": "Status",
  "leads.table.updated": "Updated",
  "leads.table.actions": "Actions",
  "leads.table.view": "View details",
  "leads.table.untitled": "Untitled lead",
  "leads.table.noCustomer": "No customer",
  "leads.table.noPhone": "No phone",
  "leads.empty": "No leads found for this stage.",
  "leads.loading": "Loading leads...",
  "leads.error": "Failed to load leads",

  "leads.ai.title": "AI assistant",
  "leads.ai.loading": "Analyzing leads...",
  "leads.ai.actions.empty": "Nothing urgent detected.",
  "leads.ai.actions.backlog": "High open/assigned volume; prioritize callbacks and follow-ups.",
  "leads.ai.actions.assigned": "Assigned leads need owner follow-up today.",
  "leads.ai.actions.stalled": "Onboarding/in-process leads may be stalled—nudge them.",
  "leads.ai.actions.lost": "Review lost leads for recovery opportunities.",
  "leads.ai.appreciation.title": "Win to celebrate",
  "leads.ai.appreciation.closed": "{count} leads closed recently. Nice work.",
  "leads.ai.appreciation.assigned": "{count} leads assigned—keep momentum.",
  "leads.ai.appreciation.empty": "Add or update leads to see AI insights.",

  // Leads assignment
  "leads.assign.recovery": "Assign Recovery Lead",
  "leads.assign.workshop": "Assign Workshop Lead",
  "leads.assign.rsa": "Assign RSA Lead",
  "leads.assign.workshop.helper": "Assign inspection leads to a registered workshop branch.",
  "leads.assign.helper": "Select branch and user to assign.",
  "leads.assign.close": "Close",
  "leads.assign.selectBranch": "Select branch",
  "leads.assign.selectUser": "Select user",
  "leads.assign.online": "(online)",
  "leads.assign.onlyInspection": "Only inspection leads can be assigned to branches.",
  "leads.assign.loadBranches": "Failed to load branches",
  "leads.assign.loadUsers": "Failed to load users",
  "leads.assign.success": "Lead assigned",
  "leads.assign.error": "Failed to assign lead",
  "leads.assign.submit": "Assign",
  "leads.assign.working": "Assigning...",

  // Lead create
  "lead.create.title": "Create Lead (global)",
  "lead.create.subtitle": "Capture a new global lead with full contact and address details, remarks, type, and status.",
  "lead.create.back": "Back to leads",
  "lead.create.companySection": "Company & address",
  "lead.create.contactSection": "Contact",
  "lead.create.settingsSection": "Lead settings",
  "lead.create.remarksSection": "Remarks",
  "lead.create.companyName": "Company name",
  "lead.create.postal": "Postal code",
  "lead.create.address": "Address",
  "lead.create.contactTitle": "Title",
  "lead.create.contactName": "Name",
  "lead.create.email": "Email",
  "lead.create.phone": "Phone",
  "lead.create.leadType": "Lead type",
  "lead.create.leadStatus": "Status",
  "lead.create.type.sales": "Sales",
  "lead.create.type.support": "Support",
  "lead.create.type.complaint": "Complaint",
  "lead.create.status.open": "Open",
  "lead.create.status.assigned": "Assigned",
  "lead.create.status.onboarding": "Onboarding",
  "lead.create.status.inprocess": "In process",
  "lead.create.status.completed": "Completed",
  "lead.create.status.closed": "Closed",
  "lead.create.status.lost": "Lost",
  "lead.create.rules":
    "Rules: Open on creation. Sales → assigned then onboarding; if company created, close, otherwise mark lost. Support/Complaint → open/assigned, then in process, completed, and closed after verification.",
  "lead.create.customerRemarks": "Customer remarks",
  "lead.create.agentRemarks": "Agent remarks",
  "lead.create.saving": "Saving...",
  "lead.create.submit": "Create lead",
  "lead.create.cancel": "Cancel",
  "lead.create.error": "Failed to create lead",

  // Lead detail
  "lead.detail.loading": "Loading lead...",
  "lead.detail.notFound": "Lead not found.",
  "lead.detail.back": "Back to leads",
  "lead.detail.customer": "Customer",
  "lead.detail.company": "Company",
  "lead.detail.tradeLicense": "Trade License",
  "lead.detail.type": "Type",
  "lead.detail.status": "Status",
  "lead.detail.assigned": "Assigned to",
  "lead.detail.assigned.placeholder": "Assignee name or email",
  "lead.detail.timeline": "Lead timeline",
  "lead.detail.remarks": "Remarks",
  "lead.detail.noRemarks": "No remarks yet.",
  "lead.detail.addRemark": "Add remark",
  "lead.detail.remark.author": "Your name",
  "lead.detail.remark.role.agent": "Agent",
  "lead.detail.remark.role.customer": "Customer",
  "lead.detail.remark.placeholder": "Add a remark",
  "lead.detail.remark.post": "Post remark",
  "lead.detail.remark.added": "Remark added",
  "lead.detail.load.error": "Failed to load lead",
  "lead.detail.load.idMissing": "Lead id missing",

  // Marketing main
  "marketing.title": "Marketing",
  "marketing.subtitle":
    "Campaigns across integrated channels (ads, email, SMS, WhatsApp) with quick access to connected tools.",
  "marketing.card.omni.title": "Omni-channel campaigns",
  "marketing.card.omni.desc": "Plan, launch, and monitor campaigns across SMS, email, and ads.",
  "marketing.card.omni.view": "View campaigns",
  "marketing.card.omni.create": "Create campaign",
  "marketing.card.ad.title": "Ad campaigns",
  "marketing.card.ad.desc": "Manage spend, bids, and tracking for connected ad platforms.",
  "marketing.card.ad.manage": "Manage ads",
  "marketing.card.ad.channels": "Channels",
  "marketing.card.sms.title": "SMS journeys",
  "marketing.card.sms.desc": "Send SMS and WhatsApp blasts or journeys with templates and sender IDs.",
  "marketing.card.sms.manage": "Manage SMS",
  "marketing.card.sms.create": "Create message",
  "marketing.card.email.title": "Email sends",
  "marketing.card.email.desc": "Newsletters, drip sequences, and transactional emails with templates.",
  "marketing.card.email.manage": "Manage email",
  "marketing.card.email.create": "Create send",
  "marketing.card.social.title": "Social posts",
  "marketing.card.social.desc": "Draft and schedule posts across connected social channels.",
  "marketing.card.social.manage": "Manage posts",
  "marketing.card.social.create": "Create post",
  "marketing.card.dialer.title": "Dialer outreach",
  "marketing.card.dialer.desc": "Use dialer integrations for outbound call campaigns and follow-ups.",
  "marketing.card.dialer.settings": "Dialer settings",
  "marketing.card.dialer.callcenter": "Call center",

  // Marketing manager generic
  "marketing.manager.filter": "Filter",
  "marketing.manager.filter.all": "All",
  "marketing.manager.create": "Create {type}",
  "marketing.manager.manage": "Manage {typePlural}",
  "marketing.manager.showing": "Showing {shown} of {total}",
  "marketing.manager.name": "Name",
  "marketing.manager.status": "Status",
  "marketing.manager.created": "Created",
  "marketing.manager.actions": "Actions",
  "marketing.manager.set": "Set {status}",
  "marketing.manager.delete": "Delete",
  "marketing.manager.save": "Save",
  "marketing.manager.saving": "Saving...",
  "marketing.manager.cancel": "Cancel",
  "marketing.manager.empty": "No {typePlural} yet. Create one to get started.",
  "marketing.manager.selectDefault": "Select {field}",

  // Marketing statuses
  "marketing.status.draft": "Draft",
  "marketing.status.scheduled": "Scheduled",
  "marketing.status.live": "Live",
  "marketing.status.paused": "Paused",
  "marketing.status.completed": "Completed",
  "marketing.status.sending": "Sending",
  "marketing.status.published": "Published",

  // Marketing campaigns page
  "marketing.campaigns.title": "Campaigns",
  "marketing.campaigns.desc": "Plan and launch omni-channel campaigns across SMS, email, and ads.",
  "marketing.campaigns.type": "campaign",
  "marketing.campaigns.typePlural": "campaigns",
  "marketing.campaigns.manager.new": "New campaign",
  "marketing.campaigns.manager.edit": "Edit",
  "marketing.campaigns.manager.performance": "Performance",
  "marketing.campaigns.field.name.label": "Name",
  "marketing.campaigns.field.name.placeholder": "Black Friday push",
  "marketing.campaigns.field.company.label": "Company",
  "marketing.campaigns.field.objective.label": "Objective",
  "marketing.campaigns.field.objective.placeholder": "Leads / awareness / retention",
  "marketing.campaigns.field.channel.label": "Primary channel",
  "marketing.campaigns.field.channel.options.sms": "SMS",
  "marketing.campaigns.field.channel.options.email": "Email",
  "marketing.campaigns.field.channel.options.whatsapp": "WhatsApp",
  "marketing.campaigns.field.channel.options.ads": "Ads",
  "marketing.campaigns.field.channel.options.push": "Push notifications",
  "marketing.campaigns.field.budget.label": "Budget",
  "marketing.campaigns.field.budget.placeholder": "5000",
  "marketing.campaigns.field.audience.label": "Audience",
  "marketing.campaigns.field.audience.placeholder": "Saved list or segment",
  "marketing.campaigns.builder.title": "Campaign builder",
  "marketing.campaigns.builder.desc": "Design the flow by connecting campaign stages.",
  "marketing.campaigns.builder.palette": "Node palette",
  "marketing.campaigns.builder.add": "Add node",
  "marketing.campaigns.builder.save": "Save",
  "marketing.campaigns.builder.load": "Load",
  "marketing.campaigns.builder.reset": "Reset",
  "marketing.campaigns.builder.settings.title": "Node settings",
  "marketing.campaigns.builder.settings.empty": "Select a node to configure.",
  "marketing.campaigns.builder.settings.channel.label": "Channel",
  "marketing.campaigns.builder.settings.template.label": "Template",
  "marketing.campaigns.builder.settings.template.loading": "Loading templates...",
  "marketing.campaigns.builder.settings.template.error": "Failed to load templates",
  "marketing.campaigns.builder.settings.template.empty": "No templates available",
  "marketing.campaigns.builder.settings.content.channel.label": "From channel",
  "marketing.campaigns.builder.settings.content.channel.missing": "Connect a channel node before choosing content.",
  "marketing.campaigns.builder.settings.content.channel.unsupported": "Templates are available only for Email or WhatsApp.",
  "marketing.campaigns.test.action": "Test campaign",
  "marketing.campaigns.test.title": "Send test campaign",
  "marketing.campaigns.test.email.label": "Test email",
  "marketing.campaigns.test.email.placeholder": "test@example.com",
  "marketing.campaigns.test.phone.label": "Test mobile",
  "marketing.campaigns.test.phone.placeholder": "+15551234567",
  "marketing.campaigns.test.send": "Send test",
  "marketing.campaigns.test.sending": "Sending...",
  "marketing.campaigns.test.close": "Close",
  "marketing.campaigns.test.success": "Test sent.",
  "marketing.campaigns.test.error": "Test failed.",
  "marketing.campaigns.test.missing": "Add a test email or mobile number.",
  "marketing.campaigns.builder.settings.condition.label": "Condition",
  "marketing.campaigns.builder.settings.condition.sourceChannel.label": "From channel",
  "marketing.campaigns.builder.settings.condition.sent": "Sent",
  "marketing.campaigns.builder.settings.condition.delivered": "Delivered",
  "marketing.campaigns.builder.settings.condition.read": "Read",
  "marketing.campaigns.builder.settings.condition.opened": "Opened message",
  "marketing.campaigns.builder.settings.condition.clicked": "Clicked link",
  "marketing.campaigns.builder.settings.condition.replied": "Replied",
  "marketing.campaigns.builder.settings.condition.converted": "Converted",
  "marketing.campaigns.builder.settings.condition.custom": "Custom rule",
  "marketing.campaigns.builder.settings.condition.custom.label": "Rule",
  "marketing.campaigns.builder.settings.condition.custom.placeholder": "e.g., spent > 1000",
  "marketing.campaigns.builder.settings.condition.attribute.label": "Attribute",
  "marketing.campaigns.builder.settings.condition.attribute.placeholder": "e.g., total_spend",
  "marketing.campaigns.builder.settings.condition.operator.label": "Operator",
  "marketing.campaigns.builder.settings.condition.operator.equals": "Equals",
  "marketing.campaigns.builder.settings.condition.operator.notEquals": "Not equals",
  "marketing.campaigns.builder.settings.condition.operator.greaterThan": "Greater than",
  "marketing.campaigns.builder.settings.condition.operator.lessThan": "Less than",
  "marketing.campaigns.builder.settings.condition.operator.contains": "Contains",
  "marketing.campaigns.builder.settings.condition.operator.startsWith": "Starts with",
  "marketing.campaigns.builder.settings.condition.operator.endsWith": "Ends with",
  "marketing.campaigns.builder.settings.condition.value.label": "Value",
  "marketing.campaigns.builder.settings.condition.value.placeholder": "e.g., 1000",
  "marketing.campaigns.builder.settings.wait.type.label": "Wait type",
  "marketing.campaigns.builder.settings.wait.type.duration": "Duration",
  "marketing.campaigns.builder.settings.wait.type.datetime": "Date & time",
  "marketing.campaigns.builder.settings.wait.duration.value.label": "Duration value",
  "marketing.campaigns.builder.settings.wait.duration.value.placeholder": "e.g., 3",
  "marketing.campaigns.builder.settings.wait.duration.unit.label": "Duration unit",
  "marketing.campaigns.builder.settings.wait.duration.unit.minutes": "Minutes",
  "marketing.campaigns.builder.settings.wait.duration.unit.hours": "Hours",
  "marketing.campaigns.builder.settings.wait.duration.unit.days": "Days",
  "marketing.campaigns.builder.settings.wait.datetime.label": "Start at",
  "marketing.campaigns.builder.settings.audience.label": "Audience",
  "marketing.campaigns.builder.settings.audience.all": "All",
  "marketing.campaigns.builder.settings.audience.segment": "Customer segment",
  "marketing.campaigns.builder.settings.audience.segment.label": "Segment",
  "marketing.campaigns.builder.settings.audience.segment.loading": "Loading segments...",
  "marketing.campaigns.builder.settings.audience.segment.error": "Failed to load segments",
  "marketing.campaigns.builder.settings.close": "Close",
  "marketing.campaigns.builder.notice.save.success": "Builder saved.",
  "marketing.campaigns.builder.notice.save.error": "Save failed. Stored locally.",
  "marketing.campaigns.builder.notice.load.success": "Builder loaded.",
  "marketing.campaigns.builder.notice.load.error": "Load failed.",
  "marketing.campaigns.builder.notice.load.empty": "No saved builder found.",
  "marketing.campaigns.builder.node.start": "Start",
  "marketing.campaigns.builder.node.audience": "Audience",
  "marketing.campaigns.builder.node.channel": "Channel",
  "marketing.campaigns.builder.node.content": "Content",
  "marketing.campaigns.builder.node.launch": "Launch",
  "marketing.campaigns.builder.node.start.desc": "Kick off the campaign.",
  "marketing.campaigns.builder.node.audience.desc": "Pick segments or saved lists.",
  "marketing.campaigns.builder.node.channel.desc": "Select the delivery channel.",
  "marketing.campaigns.builder.node.content.desc": "Attach creative and templates.",
  "marketing.campaigns.builder.node.launch.desc": "Schedule or go live.",
  "marketing.campaigns.builder.node.delay": "Wait",
  "marketing.campaigns.builder.node.delay.desc": "Add a timed pause.",
  "marketing.campaigns.builder.node.condition": "Condition",
  "marketing.campaigns.builder.node.condition.desc": "Branch by audience behavior.",
  "marketing.campaigns.builder.node.end": "End",
  "marketing.campaigns.builder.node.end.desc": "Wrap up the journey.",

  // Marketing ads page
  "marketing.ads.title": "Ad campaigns",
  "marketing.ads.desc": "Manage ad sets, budgets, and tracking for connected ad channels.",
  "marketing.ads.type": "ad campaign",
  "marketing.ads.typePlural": "ad campaigns",
  "marketing.ads.field.name.label": "Name",
  "marketing.ads.field.name.placeholder": "Search - Brand - UAE",
  "marketing.ads.field.platform.label": "Platform",
  "marketing.ads.field.platform.options.meta": "Meta",
  "marketing.ads.field.platform.options.google": "Google",
  "marketing.ads.field.platform.options.linkedin": "LinkedIn",
  "marketing.ads.field.platform.options.tiktok": "TikTok",
  "marketing.ads.field.budget.label": "Daily budget",
  "marketing.ads.field.budget.placeholder": "250",
  "marketing.ads.field.bid.label": "Bid strategy",
  "marketing.ads.field.bid.placeholder": "cpc / cpm / max conversions",
  "marketing.ads.field.tracking.label": "Tracking",
  "marketing.ads.field.tracking.placeholder": "UTM or pixel",

  // Marketing SMS page
  "marketing.sms.title": "SMS campaigns",
  "marketing.sms.desc": "Send and monitor SMS journeys using connected providers and templates.",
  "marketing.sms.type": "SMS",
  "marketing.sms.typePlural": "SMS",
  "marketing.sms.field.name.label": "Name",
  "marketing.sms.field.name.placeholder": "Renewal reminder",
  "marketing.sms.field.senderId.label": "Sender ID",
  "marketing.sms.field.senderId.placeholder": "GLOBERP",
  "marketing.sms.field.audience.label": "Audience",
  "marketing.sms.field.audience.placeholder": "Segment or list",
  "marketing.sms.field.message.label": "Message",
  "marketing.sms.field.message.placeholder": "Hi {{name}}, your policy...",

  // Marketing email page
  "marketing.email.title": "Email campaigns",
  "marketing.email.desc": "Manage newsletters, transactional sends, and drip sequences.",
  "marketing.email.type": "email send",
  "marketing.email.typePlural": "email sends",
  "marketing.email.field.subject.label": "Subject",
  "marketing.email.field.subject.placeholder": "Welcome to Global ERP",
  "marketing.email.field.template.label": "Template",
  "marketing.email.field.template.placeholder": "Template name or ID",
  "marketing.email.field.audience.label": "Audience",
  "marketing.email.field.audience.placeholder": "Segment or list",
  "marketing.email.field.from.label": "From / sender",
  "marketing.email.field.from.placeholder": "noreply@global.com",

  // Marketing posts page
  "marketing.posts.title": "Social posts",
  "marketing.posts.desc": "Draft and schedule social posts across connected channels.",
  "marketing.posts.type": "post",
  "marketing.posts.typePlural": "posts",
  "marketing.posts.field.title.label": "Title",
  "marketing.posts.field.title.placeholder": "Launch teaser",
  "marketing.posts.field.platform.label": "Platform",
  "marketing.posts.field.platform.options.facebook": "Facebook",
  "marketing.posts.field.platform.options.instagram": "Instagram",
  "marketing.posts.field.platform.options.linkedin": "LinkedIn",
  "marketing.posts.field.platform.options.x": "X",
  "marketing.posts.field.audience.label": "Audience / page",
  "marketing.posts.field.audience.placeholder": "Main page",
  "marketing.posts.field.asset.label": "Asset / URL",
  "marketing.posts.field.asset.placeholder": "Link to creative or media",
  "marketing.posts.field.caption.label": "Caption",
  "marketing.posts.field.caption.placeholder": "Copy for the post",

  // Login
  "login.title": "Sign in",
  "login.subtitle": "Access Your Dashboard",
  "login.hero.title": "One workspace for Global, Company, Branch, Vendor, and Staff operations.",
  "login.hero.body":
    "Run customers, vendors, branches, and teams with AI dialers, translations, automation, and dashboards. Pick your language and theme, then continue where you left off with remembered credentials (local-only).",
  "login.language": "Language",
  "login.theme": "Theme",
  "login.translate": "Translate",
  "login.email": "Email",
  "login.password": "Password",
  "login.rememberEmail": "Remember email on this device",
  "login.rememberPassword":
    "Remember password locally (uses local storage; not recommended on shared devices)",
  "login.button": "Log in",
  "login.button.loading": "Logging in...",
  "login.needAccess": "Need access?",
  "login.contactAdmin": "Contact admin",
  "login.chip.dialer.title": "AI Dialer",
  "login.chip.dialer.desc": "Test calls, transcripts, follow-ups.",
  "login.chip.translate.title": "Instant Translation",
  "login.chip.translate.desc": "One-click page translation & chat.",
  "login.chip.security.title": "Secure Access",
  "login.chip.security.desc": "Local-only credential memory & theme sync."
};

type TranslationsByLang = {
  [code in LanguageCode]?: Record<string, string>;
};

type I18nContextValue = {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: string) => string;
  languages: Language[];
  loadingLang: boolean;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const LANG_STORAGE_KEY = "global-erp-lang";
const I18N_STORAGE_PREFIX = "global-erp-i18n-";
const I18N_VERSION = "v3"; // bump to invalidate stale caches when adding keys
const BASE_MESSAGES_VERSION = "2025-12-28-company-leads-ai";

function loadStoredLang(): LanguageCode {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem(LANG_STORAGE_KEY) as
    | LanguageCode
    | null;
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
    return stored;
  }

  const nav = navigator.language?.slice(0, 2) as LanguageCode;
  if (nav && SUPPORTED_LANGUAGES.some((l) => l.code === nav)) {
    return nav;
  }

  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const globalUi = useOptionalGlobalUiContext();
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const fromGlobal = globalUi?.language;
    if (fromGlobal && SUPPORTED_LANGUAGES.some((l) => l.code === fromGlobal)) {
      return fromGlobal;
    }
    if (typeof window !== "undefined") {
      return loadStoredLang();
    }
    return "en";
  });
  const [translations, setTranslations] = useState<TranslationsByLang>({});
  const [loadingLang, setLoadingLang] = useState(false);

  // Initial language from storage / browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = loadStoredLang();
    setLangState((prev) => (prev === "en" ? initial : prev));
  }, []);

  // Keep in sync with GlobalUiProvider if present
  useEffect(() => {
    if (!globalUi?.language) return;
    if (lang !== globalUi.language) {
      setLangState(globalUi.language as LanguageCode);
    }
  }, [globalUi?.language]);

  // Persist language + update <html dir="">
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);

    const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    if (langMeta) {
      document.documentElement.lang = langMeta.code;
      document.documentElement.dir = langMeta.dir;
    }
  }, [lang]);

  // Load translations for non-English languages
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lang === "en") return;

    // Drop legacy cached translations (pre-versioning) to avoid stale partial translations
    window.localStorage.removeItem(`${I18N_STORAGE_PREFIX}${lang}`);

    const storageKey = `${I18N_STORAGE_PREFIX}${I18N_VERSION}-${BASE_MESSAGES_VERSION}-${lang}`;
    const baseKeys = Object.keys(BASE_MESSAGES);
    let needFetch = true;

    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setTranslations((prev) => ({ ...prev, [lang]: parsed }));
        const hasAll = baseKeys.every((k) => Object.prototype.hasOwnProperty.call(parsed, k));
        needFetch = !hasAll;
        if (!needFetch) return;
      } catch {
        // ignore and fetch fresh
      }
    }

    let cancelled = false;
      async function fetchTranslations() {
        setLoadingLang(true);
        try {
          const res = await fetch("/api/i18n-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetLang: lang,
              messages: BASE_MESSAGES,
            }),
          });

          const contentType = res.headers.get("content-type") || "";
          const jsonOk = res.ok && contentType.includes("application/json");
          if (!jsonOk) {
            // Gracefully fallback without throwing noisy console errors in dev
            setTranslations((prev) => ({ ...prev, [lang]: BASE_MESSAGES }));
            if (!res.ok) {
              console.warn("i18n translate fetch failed; using base messages");
            }
            return;
          }

          const data = (await res.json().catch(() => ({ translations: BASE_MESSAGES }))) as {
            translations: Record<string, string>;
          };

          if (cancelled) return;

          setTranslations((prev) => ({ ...prev, [lang]: data.translations }));
          window.localStorage.setItem(
          storageKey,
          JSON.stringify(data.translations)
        );
      } catch (err) {
        console.error("Error fetching translations", err);
      } finally {
        if (!cancelled) setLoadingLang(false);
      }
    }

    if (needFetch) {
      fetchTranslations();
    }

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: (code: LanguageCode) => {
        setLangState(code);
        globalUi?.setLanguage?.(code as any);
      },
      languages: SUPPORTED_LANGUAGES,
      loadingLang,
      t: (key: string) => {
        if (lang === "en") {
          return BASE_MESSAGES[key] ?? key;
        }
        const langMap = translations[lang];
        if (langMap && langMap[key]) return langMap[key];
        return BASE_MESSAGES[key] ?? key;
      },
    }),
    [lang, translations, loadingLang, globalUi]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
