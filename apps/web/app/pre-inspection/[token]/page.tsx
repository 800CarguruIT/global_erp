"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Params = { params: { token: string } | Promise<{ token: string }> };

type Answer = { choice: "yes" | "no"; details: string };
type Answers = {
  q1: Answer;
  q2: Answer;
  q3: Answer;
  q4: Answer;
  q5: Answer;
  q6: Answer;
  q7: Answer;
  q8: Answer;
};

type FormDataResponse = {
  form: {
    id: string;
    status: "pending" | "submitted";
    appointment_type: "walkin" | "recovery";
    company_id?: string;
    lead_id?: string;
  };
  customerName: string | null;
  carLabel: string | null;
  carPlate: string | null;
};

type FollowUpInputType = "radio" | "checkbox" | "text" | "date";
type FollowUpQuestion = {
  id: string;
  label: string;
  type: FollowUpInputType;
  options?: string[];
  required?: boolean;
};
type FollowUpValues = Record<keyof Answers, Record<string, string | string[]>>;

const QUESTION_LABELS: Record<keyof Answers, string> = {
  q1: "Any performance issue?",
  q2: "Any unusual sound or vibration?",
  q3: "Any warning light or service alert?",
  q4: "Any recent incident that triggered this request?",
  q5: "Any urgent priority for inspection?",
  q6: "Any AC issue?",
  q7: "Last service",
  q8: "Last work",
};

const EMPTY_ANSWERS: Answers = {
  q1: { choice: "no", details: "" },
  q2: { choice: "no", details: "" },
  q3: { choice: "no", details: "" },
  q4: { choice: "no", details: "" },
  q5: { choice: "no", details: "" },
  q6: { choice: "no", details: "" },
  q7: { choice: "yes", details: "" },
  q8: { choice: "yes", details: "" },
};

const FOLLOW_UP_QUESTIONS: Record<keyof Answers, FollowUpQuestion[]> = {
  q1: [
    { id: "issue_type", label: "Main performance issue", type: "radio", required: true, options: ["Low power", "Slow acceleration", "Overheating", "Poor fuel economy", "Other"] },
    { id: "issue_when", label: "When did it start?", type: "radio", required: true, options: ["Today", "1-3 days ago", "Within 1 week", "More than 1 week"] },
    { id: "drivable", label: "Vehicle drivable?", type: "radio", required: true, options: ["Yes", "No", "Not sure"] },
  ],
  q2: [
    { id: "sound_type", label: "Type of sound/vibration", type: "checkbox", required: true, options: ["Knocking", "Grinding", "Squeaking", "Steering vibration", "Braking vibration", "Other"] },
    { id: "sound_when", label: "When is it noticeable?", type: "checkbox", required: true, options: ["Idle", "Acceleration", "Braking", "Turning", "High speed", "Other"] },
  ],
  q3: [
    { id: "warning_type", label: "Warning indicator", type: "checkbox", required: true, options: ["Check Engine", "Oil", "Battery", "ABS", "Brake", "Temperature"] },
    { id: "warning_state", label: "Indicator state", type: "radio", required: true, options: ["Always ON", "Flashing", "Intermittent"] },
  ],
  q4: [
    { id: "incident_type", label: "Incident type", type: "checkbox", required: true, options: ["Minor collision", "Pothole impact", "Flood/rain exposure", "Tire puncture", "Battery drain", "Other"] },
    { id: "incident_date", label: "Incident date/time", type: "text", required: true },
  ],
  q5: [
    { id: "priority_level", label: "Priority level", type: "radio", required: true, options: ["Critical (same day)", "High (within 24h)", "Normal (within 2-3 days)"] },
    { id: "constraints", label: "Special constraints", type: "checkbox", options: ["Need quick turnaround", "Need pickup support", "Need estimate first", "Need courtesy car", "Other"] },
  ],
  q6: [
    { id: "ac_issue_type", label: "AC issue", type: "checkbox", required: true, options: ["Pooling", "Smell"] },
  ],
  q7: [
    { id: "last_service_date", label: "Last service date", type: "date", required: true },
  ],
  q8: [
    { id: "last_work_date", label: "Last work date", type: "date", required: true },
    { id: "last_work_description", label: "Last work description", type: "text", required: true },
  ],
};

const OTHER_DETAIL_REQUIRED_FIELDS = new Set([
  "issue_type",
  "sound_type",
  "sound_when",
  "incident_type",
  "constraints",
]);

const ALWAYS_ON_QUESTIONS = new Set<keyof Answers>(["q7", "q8"]);

function createEmptyFollowUps(): FollowUpValues {
  return {
    q1: {},
    q2: {},
    q3: {},
    q4: {},
    q5: {},
    q6: {},
    q7: {},
    q8: {},
  };
}

function parseDetailsToFollowUps(key: keyof Answers, details: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const raw = String(details ?? "").trim();
  if (!raw) return out;

  const chunks = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const remainingNotes: string[] = [];
  const defs = FOLLOW_UP_QUESTIONS[key];

  for (const chunk of chunks) {
    const sep = chunk.indexOf(":");
    if (sep <= 0) {
      remainingNotes.push(chunk);
      continue;
    }
    const label = chunk.slice(0, sep).trim().toLowerCase();
    const value = chunk.slice(sep + 1).trim();
    const otherSuffix = " (other)";
    const isOtherDetailLine = label.endsWith(otherSuffix);
    const baseLabel = isOtherDetailLine ? label.slice(0, -otherSuffix.length).trim() : label;
    const def = defs.find((d) => d.label.toLowerCase() === baseLabel);
    if (!def) {
      if (label === "additional notes") {
        out.__note = value;
      } else {
        remainingNotes.push(chunk);
      }
      continue;
    }
    if (isOtherDetailLine) {
      out[`${def.id}_other`] = value;
      continue;
    }
    if (def.type === "checkbox") {
      out[def.id] = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    } else {
      out[def.id] = value;
    }
  }

  if (remainingNotes.length) {
    const existing = String(out.__note ?? "").trim();
    out.__note = [existing, remainingNotes.join(" | ")].filter(Boolean).join(" | ");
  }
  return out;
}

function normalizeAnswers(input: any): Answers {
  const result = { ...EMPTY_ANSWERS };
  for (const key of Object.keys(EMPTY_ANSWERS) as Array<keyof Answers>) {
    const raw = input?.[key];
    if (!raw || typeof raw !== "object") continue;
    const choice = raw.choice === "yes" ? "yes" : "no";
    const details = String(raw.details ?? "");
    result[key] = { choice, details };
  }
  return result;
}

function TinyIcon({
  kind,
  className = "h-4 w-4",
}: {
  kind:
    | "question"
    | "yes"
    | "no"
    | "terms"
    | "sign"
    | "submit"
    | "radio"
    | "check"
    | "text"
    | "power"
    | "speed"
    | "heat"
    | "fuel"
    | "calendar"
    | "clock"
    | "drive"
    | "warning"
    | "battery"
    | "brake"
    | "incident"
    | "rain"
    | "tire"
    | "priority"
    | "pickup"
    | "car";
  className?: string;
}) {
  const common = { className, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
  if (kind === "question") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M7.8 7.2a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 1.8" />
        <circle cx="10" cy="14.4" r=".6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "yes") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="m6.8 10.2 2.2 2.2 4.2-4.2" />
      </svg>
    );
  }
  if (kind === "no") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="m7.2 7.2 5.6 5.6m0-5.6-5.6 5.6" />
      </svg>
    );
  }
  if (kind === "terms") {
    return (
      <svg {...common}>
        <path d="M6 4.8h6.2l1.8 1.9v8.5H6z" />
        <path d="M12.2 4.8v2h1.8" />
        <path d="M7.8 9h4.8m-4.8 2.2h4.8" />
      </svg>
    );
  }
  if (kind === "sign") {
    return (
      <svg {...common}>
        <path d="M3.8 12.8h12.4M4.8 10.2l2.6-2.7 2.6 2.7 4-4" />
      </svg>
    );
  }
  if (kind === "radio") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7.5" />
        <circle cx="10" cy="10" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "check") {
    return (
      <svg {...common}>
        <rect x="3.8" y="3.8" width="12.4" height="12.4" rx="2.2" />
        <path d="m6.9 10.1 2 2.1 4.3-4.3" />
      </svg>
    );
  }
  if (kind === "text") {
    return (
      <svg {...common}>
        <rect x="3.4" y="4.5" width="13.2" height="11" rx="2.2" />
        <path d="M6.3 8.2h7.4M6.3 11h5.6" />
      </svg>
    );
  }
  if (kind === "power") {
    return (
      <svg {...common}>
        <rect x="3.8" y="6.2" width="11.8" height="7.6" rx="1.6" />
        <path d="M15.6 8.5h.9v3h-.9M8.7 7.9 7.2 10h1.5L7.9 12" />
      </svg>
    );
  }
  if (kind === "speed") {
    return (
      <svg {...common}>
        <path d="M4.2 12.8a5.8 5.8 0 1 1 11.6 0" />
        <path d="m10 10 3-2" />
      </svg>
    );
  }
  if (kind === "heat") {
    return (
      <svg {...common}>
        <path d="M10 4.2v7.2" />
        <circle cx="10" cy="13.2" r="2.6" />
      </svg>
    );
  }
  if (kind === "fuel") {
    return (
      <svg {...common}>
        <path d="M6 5.2h6v9.6H6z" />
        <path d="M12 7.2h1.4l1 1.3v3.7" />
      </svg>
    );
  }
  if (kind === "calendar") {
    return (
      <svg {...common}>
        <rect x="4.2" y="5.2" width="11.6" height="10.4" rx="1.6" />
        <path d="M4.2 8.2h11.6M7 4.2v2M13 4.2v2" />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="6.8" />
        <path d="M10 6.8v3.6l2.6 1.6" />
      </svg>
    );
  }
  if (kind === "drive") {
    return (
      <svg {...common}>
        <path d="M4.6 11.8h10.8l-1-3.4H5.6z" />
        <circle cx="6.8" cy="13.4" r="1.2" />
        <circle cx="13.2" cy="13.4" r="1.2" />
      </svg>
    );
  }
  if (kind === "warning") {
    return (
      <svg {...common}>
        <path d="m10 4.2 6.2 10.6H3.8z" />
        <path d="M10 8v3.2M10 13v.2" />
      </svg>
    );
  }
  if (kind === "battery") {
    return (
      <svg {...common}>
        <rect x="4.2" y="6.2" width="10.8" height="7.6" rx="1.4" />
        <path d="M15 8.8h.8v2.4H15M8 10h3.8M9.9 8.1v3.8" />
      </svg>
    );
  }
  if (kind === "brake") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="6.6" />
        <circle cx="10" cy="10" r="2.3" />
      </svg>
    );
  }
  if (kind === "incident") {
    return (
      <svg {...common}>
        <path d="M4.8 12h4.2l2.2-2.1h4" />
        <path d="M8.5 10.6 6.8 8.9m0 1.7 1.7-1.7" />
      </svg>
    );
  }
  if (kind === "rain") {
    return (
      <svg {...common}>
        <path d="M6 9.4a3 3 0 1 1 5.8-1 2.4 2.4 0 1 1 .7 4.8H6.2" />
        <path d="m7.2 14.2-.6 1.2m3-1.2-.6 1.2m3-1.2-.6 1.2" />
      </svg>
    );
  }
  if (kind === "tire") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="6.6" />
        <path d="M10 3.4v13.2M3.4 10h13.2" />
      </svg>
    );
  }
  if (kind === "priority") {
    return (
      <svg {...common}>
        <path d="M6 4.8h8v7.8H6z" />
        <path d="M6 4.8 5 3.8M6 12.6 5 13.8" />
      </svg>
    );
  }
  if (kind === "pickup") {
    return (
      <svg {...common}>
        <path d="M4.6 11.8h10.8l-1-3.4H5.6z" />
        <path d="m8 7.4 2-2 2 2" />
      </svg>
    );
  }
  if (kind === "car") {
    return (
      <svg {...common}>
        <path d="M4.6 11.8h10.8l-1-3.4H5.6z" />
        <circle cx="6.8" cy="13.4" r="1.2" />
        <circle cx="13.2" cy="13.4" r="1.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m4.5 10.2 3.1 3.1 7.9-7.9" />
    </svg>
  );
}

type IconKind =
  | "question"
  | "yes"
  | "no"
  | "terms"
  | "sign"
  | "submit"
  | "radio"
  | "check"
  | "text"
  | "power"
  | "speed"
  | "heat"
  | "fuel"
  | "calendar"
  | "clock"
  | "drive"
  | "warning"
  | "battery"
  | "brake"
  | "incident"
  | "rain"
  | "tire"
  | "priority"
  | "pickup"
  | "car";

function iconForOption(label: string): IconKind {
  const text = label.toLowerCase();
  if (text.includes("low power")) return "power";
  if (text.includes("acceleration")) return "speed";
  if (text.includes("overheating") || text.includes("temperature")) return "heat";
  if (text.includes("fuel")) return "fuel";
  if (text.includes("today") || text.includes("days") || text.includes("week")) return "calendar";
  if (text.includes("same day") || text.includes("24h")) return "clock";
  if (text.includes("drivable")) return "drive";
  if (text.includes("warning") || text.includes("check engine") || text.includes("abs")) return "warning";
  if (text.includes("battery")) return "battery";
  if (text.includes("brake")) return "brake";
  if (text.includes("collision") || text.includes("impact")) return "incident";
  if (text.includes("flood") || text.includes("rain")) return "rain";
  if (text.includes("tire") || text.includes("puncture")) return "tire";
  if (text.includes("critical") || text.includes("high") || text.includes("priority")) return "priority";
  if (text.includes("pickup")) return "pickup";
  if (text.includes("car")) return "car";
  return "question";
}

export default function PreInspectionPublicPage({ params }: Params) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormDataResponse | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [followUps, setFollowUps] = useState<FollowUpValues>(createEmptyFollowUps());

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      setToken(String(p?.token ?? "").trim());
    });
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/public/pre-inspection/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(String(json?.error ?? "Failed to load form"));
        setLoading(false);
        return;
      }
      setFormData(json.data ?? null);
      const existingAnswers = (json.data?.form?.answers ?? null) as Answers | null;
      if (existingAnswers) {
        const normalized = normalizeAnswers(existingAnswers);
        setAnswers(normalized);
        const nextFollowUps = createEmptyFollowUps();
        for (const key of Object.keys(normalized) as Array<keyof Answers>) {
          if (normalized[key].choice === "yes" && normalized[key].details.trim()) {
            nextFollowUps[key] = parseDetailsToFollowUps(key, normalized[key].details);
          }
        }
        setFollowUps(nextFollowUps);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isSubmitted = formData?.form?.status === "submitted";
  const title = useMemo(
    () =>
      formData?.form?.appointment_type === "recovery"
        ? "Vehicle Pick-up Form"
        : "Pre-Inspection Form",
    [formData?.form?.appointment_type]
  );

  function updateAnswer(key: keyof Answers, patch: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    if (patch.choice === "no") {
      setFollowUps((prev) => ({ ...prev, [key]: {} }));
    }
  }

  function setFollowUpValue(key: keyof Answers, fieldId: string, value: string | string[]) {
    setFollowUps((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [fieldId]: value,
      },
    }));
  }

  function isOtherSelected(key: keyof Answers, fieldId: string): boolean {
    const question = FOLLOW_UP_QUESTIONS[key].find((q) => q.id === fieldId);
    if (!question || !OTHER_DETAIL_REQUIRED_FIELDS.has(fieldId)) return false;
    const raw = followUps[key]?.[fieldId];
    if (question.type === "checkbox") {
      const arr = Array.isArray(raw) ? raw : [];
      return arr.includes("Other");
    }
    return String(raw ?? "") === "Other";
  }

  function composeQuestionDetails(key: keyof Answers): string {
    const values = followUps[key] ?? {};
    const questions = FOLLOW_UP_QUESTIONS[key];
    const lines: string[] = [];
    for (const q of questions) {
      const raw = values[q.id];
      if (q.type === "checkbox") {
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length) lines.push(`${q.label}: ${arr.join(", ")}`);
        if (OTHER_DETAIL_REQUIRED_FIELDS.has(q.id)) {
          const otherVal = String(values[`${q.id}_other`] ?? "").trim();
          if (arr.includes("Other") && otherVal) lines.push(`${q.label} (Other): ${otherVal}`);
        }
        continue;
      }
      const val = String(raw ?? "").trim();
      if (val) lines.push(`${q.label}: ${val}`);
      if (OTHER_DETAIL_REQUIRED_FIELDS.has(q.id)) {
        const otherVal = String(values[`${q.id}_other`] ?? "").trim();
        const hasOther = q.type === "checkbox"
          ? (Array.isArray(raw) ? raw : []).includes("Other")
          : val === "Other";
        if (hasOther && otherVal) lines.push(`${q.label} (Other): ${otherVal}`);
      }
    }
    const note = String(values.__note ?? "").trim();
    if (note) lines.push(`Additional notes: ${note}`);
    return lines.join(" | ");
  }

  function buildSubmissionAnswers(): Answers {
    const output = { ...answers };
    for (const key of Object.keys(output) as Array<keyof Answers>) {
      if (ALWAYS_ON_QUESTIONS.has(key)) {
        output[key] = {
          ...output[key],
          choice: "yes",
          details: composeQuestionDetails(key),
        };
      } else if (output[key].choice === "yes") {
        output[key] = {
          ...output[key],
          details: composeQuestionDetails(key),
        };
      } else {
        output[key] = { ...output[key], details: "" };
      }
    }
    return output;
  }

  function validateForm(): string | null {
    const submissionAnswers = buildSubmissionAnswers();
    for (const key of Object.keys(submissionAnswers) as Array<keyof Answers>) {
      if (submissionAnswers[key].choice !== "yes" && !ALWAYS_ON_QUESTIONS.has(key)) continue;
      const values = followUps[key] ?? {};
      const questions = FOLLOW_UP_QUESTIONS[key];
      for (const q of questions) {
        if (!q.required) continue;
        const raw = values[q.id];
        if (q.type === "checkbox") {
          const arr = Array.isArray(raw) ? raw : [];
          if (!arr.length) return `${QUESTION_LABELS[key]}: ${q.label} is required.`;
          continue;
        }
        if (!String(raw ?? "").trim()) return `${QUESTION_LABELS[key]}: ${q.label} is required.`;
      }
      for (const q of questions) {
        if (!OTHER_DETAIL_REQUIRED_FIELDS.has(q.id) || !isOtherSelected(key, q.id)) continue;
        const otherVal = String(values[`${q.id}_other`] ?? "").trim();
        if (!otherVal) return `${QUESTION_LABELS[key]}: ${q.label} other details are required.`;
      }
      if (!submissionAnswers[key].details.trim()) {
        return `${QUESTION_LABELS[key]}: details are required when Yes is selected.`;
      }
    }
    if (!termsAccepted) return "Please accept terms before submitting.";
    if (!signatureDataUrl) return "Please add your signature before submitting.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const submissionAnswers = buildSubmissionAnswers();
      const res = await fetch(`/api/public/pre-inspection/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsAccepted,
          signatureDataUrl,
          answers: submissionAnswers,
          aiSummary: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to submit form"));
      setSuccess("Form submitted successfully.");
      setFormData((prev) => (prev ? { ...prev, form: { ...prev.form, status: "submitted" } } : prev));
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <TinyIcon kind="question" className="h-5 w-5 text-cyan-300" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Please complete this mandatory form before the next stage.
          </p>
        </div>

        {loading ? <div className="mt-4 text-sm text-slate-300">Loading...</div> : null}
        {error ? <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}

        {!loading && formData ? (
          <form onSubmit={onSubmit} className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
              <div><span className="text-slate-400">Customer:</span> {formData.customerName ?? "-"}</div>
              <div><span className="text-slate-400">Car:</span> {formData.carLabel ?? "-"}</div>
              <div><span className="text-slate-400">Plate:</span> {formData.carPlate ?? "-"}</div>
            </div>

            {(Object.keys(QUESTION_LABELS) as Array<keyof Answers>).map((key) => (
              <div key={key} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <TinyIcon kind="question" className="h-5 w-5 text-cyan-300" />
                  {QUESTION_LABELS[key]}
                </div>

                {!ALWAYS_ON_QUESTIONS.has(key) ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => updateAnswer(key, { choice: "yes" })}
                      disabled={isSubmitted}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${
                        answers[key].choice === "yes"
                          ? "border-emerald-300/70 bg-emerald-500/15 text-emerald-100"
                          : "border-white/20 text-slate-200"
                      }`}
                    >
                      <TinyIcon kind="yes" className="h-4 w-4 text-emerald-300" />
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAnswer(key, { choice: "no", details: "" })}
                      disabled={isSubmitted}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${
                        answers[key].choice === "no"
                          ? "border-rose-300/70 bg-rose-500/15 text-rose-100"
                          : "border-white/20 text-slate-200"
                      }`}
                    >
                      <TinyIcon kind="no" className="h-4 w-4 text-rose-300" />
                      No
                    </button>
                  </div>
                ) : null}

                {answers[key].choice === "yes" || ALWAYS_ON_QUESTIONS.has(key) ? (
                  <div className="mt-4 space-y-4">
                    {FOLLOW_UP_QUESTIONS[key].map((fq) => (
                      <div key={fq.id}>
                        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-200">
                          <TinyIcon
                            kind={fq.type === "checkbox" ? "check" : fq.type === "radio" ? "radio" : "text"}
                            className="h-4 w-4 text-cyan-300"
                          />
                          {fq.label}
                          {fq.required ? " *" : ""}
                        </div>
                        {fq.type === "radio" ? (
                          <div className="flex flex-wrap gap-2">
                            {(fq.options ?? []).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setFollowUpValue(key, fq.id, opt)}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                  String(followUps[key]?.[fq.id] ?? "") === opt
                                    ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                                    : "border-white/20 text-slate-200"
                                }`}
                                disabled={isSubmitted}
                              >
                                <TinyIcon kind={iconForOption(opt)} className="h-3.5 w-3.5 text-cyan-300" />
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {fq.type === "checkbox" ? (
                          <div className="flex flex-wrap gap-2">
                            {(fq.options ?? []).map((opt) => {
                              const selected = Array.isArray(followUps[key]?.[fq.id])
                                ? (followUps[key]?.[fq.id] as string[])
                                : [];
                              const checked = selected.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    const current = Array.isArray(followUps[key]?.[fq.id])
                                      ? [...(followUps[key]?.[fq.id] as string[])]
                                      : [];
                                    const next = checked
                                      ? current.filter((v) => v !== opt)
                                      : Array.from(new Set([...current, opt]));
                                    setFollowUpValue(key, fq.id, next);
                                  }}
                                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                    checked
                                      ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                                      : "border-white/20 text-slate-200"
                                  }`}
                                  disabled={isSubmitted}
                                >
                                  <TinyIcon kind={iconForOption(opt)} className="h-3.5 w-3.5 text-cyan-300" />
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {fq.type === "text" || fq.type === "date" ? (
                          <div className="space-y-2">
                            <input
                              type={fq.type === "date" ? "date" : "text"}
                              className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm outline-none"
                              placeholder={fq.type === "date" ? undefined : "Enter details"}
                              value={String(followUps[key]?.[fq.id] ?? "")}
                              onChange={(e) => setFollowUpValue(key, fq.id, e.target.value)}
                              disabled={isSubmitted}
                            />
                            {OTHER_DETAIL_REQUIRED_FIELDS.has(fq.id) && isOtherSelected(key, fq.id) ? (
                              <input
                                type="text"
                                className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm outline-none"
                                placeholder="Specify other"
                                value={String(followUps[key]?.[`${fq.id}_other`] ?? "")}
                                onChange={(e) => setFollowUpValue(key, `${fq.id}_other`, e.target.value)}
                                disabled={isSubmitted}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {fq.type !== "text" && OTHER_DETAIL_REQUIRED_FIELDS.has(fq.id) && isOtherSelected(key, fq.id) ? (
                          <input
                            type="text"
                            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm outline-none"
                            placeholder="Specify other"
                            value={String(followUps[key]?.[`${fq.id}_other`] ?? "")}
                            onChange={(e) => setFollowUpValue(key, `${fq.id}_other`, e.target.value)}
                            disabled={isSubmitted}
                          />
                        ) : null}
                      </div>
                    ))}

                    <div>
                      <div className="mb-1 text-sm font-medium text-slate-200">Additional notes (optional)</div>
                      <textarea
                        className="w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm outline-none"
                        rows={3}
                        placeholder="Any extra information for advisor"
                        value={String(followUps[key]?.__note ?? "")}
                        onChange={(e) => setFollowUpValue(key, "__note", e.target.value)}
                        disabled={isSubmitted}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            <label className="inline-flex items-center gap-2 text-sm">
              <TinyIcon kind="terms" className="h-4 w-4 text-cyan-300" />
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={isSubmitted}
              />
              I accept the{" "}
              <a
                href={`/pre-inspection/${encodeURIComponent(token)}/terms`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                terms and conditions
              </a>.
            </label>

            <SignaturePad
              disabled={isSubmitted}
              onChange={(value) => setSignatureDataUrl(value)}
            />

            <div>
              <button
                type="submit"
                disabled={submitting || isSubmitted}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                <TinyIcon kind="submit" className="h-4 w-4 text-emerald-300" />
                {isSubmitted ? "Already Submitted" : submitting ? "Submitting..." : "Submit Form"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}

function SignaturePad({ disabled, onChange }: { disabled?: boolean; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    onChange("");
  }, [onChange]);

  function getCtx(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#e2e8f0";
    return ctx;
  }

  function getPos(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in evt) {
      const touch = evt.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function startDraw(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    if (disabled) return;
    const ctx = getCtx(canvas);
    if (!ctx) return;
    const { x, y } = getPos(canvas, evt);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function moveDraw(canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) {
    if (!drawing || disabled) return;
    const ctx = getCtx(canvas);
    if (!ctx) return;
    const { x, y } = getPos(canvas, evt);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStroke) setHasStroke(true);
  }

  function endDraw(canvas: HTMLCanvasElement) {
    if (!drawing) return;
    setDrawing(false);
    if (!hasStroke) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange("");
  }

  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <TinyIcon kind="sign" className="h-4 w-4 text-cyan-300" />
        Signature
      </div>
      <div className="overflow-hidden rounded-lg border border-white/15 bg-slate-950/60">
        <canvas
          ref={canvasRef}
          width={700}
          height={220}
          className="h-44 w-full touch-none"
          onMouseDown={(e) => {
            const c = e.currentTarget;
            startDraw(c, e);
          }}
          onMouseMove={(e) => {
            const c = e.currentTarget;
            moveDraw(c, e);
          }}
          onMouseUp={(e) => endDraw(e.currentTarget)}
          onMouseLeave={(e) => endDraw(e.currentTarget)}
          onTouchStart={(e) => {
            e.preventDefault();
            startDraw(e.currentTarget, e);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            moveDraw(e.currentTarget, e);
          }}
          onTouchEnd={(e) => endDraw(e.currentTarget)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-white/20 px-2 py-1 text-xs"
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) clear(canvas);
          }}
          disabled={disabled}
        >
          Clear Signature
        </button>
        <span className="text-xs text-slate-400">{hasStroke ? "Signature added" : "Please sign in the box"}</span>
      </div>
    </div>
  );
}
