import { AlertCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import type { IndustryValue } from "../lib/industryOptions";
import { INDUSTRY_OPTIONS } from "../lib/industryOptions";
import { INFRA_OPTIONS, type InfraValue } from "../lib/infraOptions";
import { AuthLayout } from "../layouts/AuthLayout";

// ─── Shared styles ───────────────────────────────────────────────────────────
const SELECT_CLASS =
  "w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20";

const SELECT_ERROR_CLASS =
  "w-full rounded-xl border border-danger/80 bg-[#0c152d]/80 px-2.5 py-2 text-sm text-text outline-none transition focus:border-danger/70 focus:ring-2 focus:ring-danger/20";

const TEXTAREA_CLASS =
  "min-h-[4.25rem] w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm leading-snug text-text outline-none transition placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20 sm:min-h-[3.75rem]";

// ─── Validation helpers ───────────────────────────────────────────────────────
const FULL_NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/;
const COMPANY_NAME_RE = /^[A-Za-z0-9\s&,.\-']+$/;
const JOB_TITLE_RE = /^[A-Za-z0-9\s/,.\-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFullName(v: string): string {
  const t = v.trim();
  if (!t) return "Full name is required.";
  if (!FULL_NAME_RE.test(t))
    return "Please enter your first and last name (letters, spaces, hyphens, and apostrophes only).";
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "Please enter both your first and last name.";
  if (t.length < 5) return "Full name must be at least 5 characters.";
  return "";
}

function validateCompanyName(v: string): string {
  const t = v.trim();
  if (!t) return "Company name is required.";
  if (!COMPANY_NAME_RE.test(t))
    return "Company name may only contain letters, numbers, spaces, and & - , . ' characters.";
  if (!/[A-Za-z]/.test(t)) return "Company name must contain at least one letter.";
  return "";
}

function validateJobTitle(v: string): string {
  const t = v.trim();
  if (!t) return "Job title is required.";
  if (!JOB_TITLE_RE.test(t))
    return "Enter a valid job title (e.g. OT Security Engineer). No special characters.";
  if (/^\d+$/.test(t)) return "Job title must not consist of numbers only.";
  return "";
}

function validateEmail(v: string): string {
  const t = v.trim();
  if (!t) return "Work email is required.";
  if (!EMAIL_RE.test(t)) return "Please enter a valid work email address (e.g. you@company.com).";
  return "";
}

// ─── Inline error message component ──────────────────────────────────────────
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-xs text-danger">
      <AlertCircle size={13} />
      {msg}
    </span>
  );
}

// ─── Editable Combobox Component ──────────────────────────────────────────────
function EditableCombobox({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  options: readonly { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "other") {
      onChange(""); // Clear the value so they can type
      setIsEditing(true);
    } else {
      onChange(e.target.value);
    }
  };

  const handleClear = () => {
    setIsEditing(false);
    onChange(options[0].value);
  };

  if (isEditing) {
    return (
      <div className="min-w-0 relative">
        <span className="mb-1 block text-xs text-muted sm:text-sm">{label}</span>
        <div className="relative">
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={[
              "w-full rounded-xl border bg-[#0c152d]/80 px-2.5 py-2 pr-8 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20",
              error ? "border-danger/80" : "border-white/15"
            ].join(" ")}
            autoFocus
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted transition hover:text-text"
            title="Cancel custom input"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        {error ? <FieldError msg={error} /> : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs text-muted sm:text-sm">{label}</span>
      <select id={id} value={value} onChange={handleSelectChange} className={error ? SELECT_ERROR_CLASS : SELECT_CLASS}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? <FieldError msg={error} /> : null}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate();

  // Field values
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [industryType, setIndustryType] = useState("industrial_automation");
  const [infraType, setInfraType] = useState("plc_network");
  const [estimatedDevices, setEstimatedDevices] = useState("");
  const [country, setCountry] = useState("");
  const [purposeOfAccess, setPurposeOfAccess] = useState("");
  const [password, setPassword] = useState("");

  // Touched flags — errors only show after user has interacted with a field
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));
  const touchAll = () =>
    setTouched({
      fullName: true,
      companyName: true,
      email: true,
      jobTitle: true,
      industryType: true,
      infraType: true,
      estimatedDevices: true,
      country: true,
      purposeOfAccess: true,
      password: true,
    });

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");

  // ── Derived infrastructure value sent to API ─────────────────────────────
  const resolvedInfraLabel = useMemo(() => {
    const matched = INFRA_OPTIONS.find((o) => o.value === infraType);
    return matched ? matched.label : infraType.trim();
  }, [infraType]);

  // ── Validation ────────────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const n = parseInt(estimatedDevices.trim(), 10);
    const devOk =
      estimatedDevices.trim() !== "" &&
      Number.isFinite(n) &&
      n >= 1 &&
      n <= 10_000_000;

    return {
      fullName: validateFullName(fullName),
      companyName: validateCompanyName(companyName),
      email: validateEmail(email),
      jobTitle: validateJobTitle(jobTitle),
      industryType: !industryType.trim() ? "Please specify your industry." : "",
      infraType: !infraType.trim() ? "Please specify your infrastructure type." : "",
      estimatedDevices:
        estimatedDevices.trim() !== "" && !devOk
          ? "Enter a realistic device count (1–10,000,000)."
          : "",
      country: !country.trim()
        ? "Country is required."
        : country.trim().length < 2
        ? "Minimum 2 characters."
        : "",
      purposeOfAccess:
        !purposeOfAccess.trim()
          ? "Purpose of access is required."
          : purposeOfAccess.trim().length < 20
          ? "Purpose must be at least 20 characters."
          : "",
      password: !password
        ? "Password is required."
        : password.length < 8
        ? "Minimum 8 characters."
        : "",
    };
  }, [fullName, companyName, email, jobTitle, industryType, infraType, estimatedDevices, country, purposeOfAccess, password]);

  // Whether any error exists at all (for submit guard)
  const hasErrors = Object.values(errors).some(Boolean);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitInfo("");
    touchAll();

    const n = parseInt(estimatedDevices.trim(), 10);

    if (hasErrors || !estimatedDevices.trim() || !Number.isFinite(n) || n < 1) {
      setSubmitError("Please fix the highlighted fields and complete all requirements.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        jobTitle: jobTitle.trim(),
        industryType,
        infrastructureType: resolvedInfraLabel,
        estimatedDeviceCount: n,
        country: country.trim(),
        purposeOfAccess: purposeOfAccess.trim(),
        password,
      });

      setSubmitInfo("Request submitted. Check your email to verify your account.");
      navigate("/login", { state: { pendingEmailVerification: true } });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create account right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Request OT platform access"
      subtitle="Industrial onboarding — submitted data is reviewed before access is provisioned."
      onboardingLayout
    >
      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">

          {/* Full Name */}
          <div className="min-w-0">
            <InputField
              id="full-name"
              label="Full Name *"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(v) => { setFullName(v); touch("fullName"); }}
              error={touched.fullName ? errors.fullName : ""}
              compact
            />
          </div>

          {/* Company Name */}
          <div className="min-w-0">
            <InputField
              id="company-name"
              label="Company Name *"
              placeholder="ACME Utilities"
              value={companyName}
              onChange={(v) => { setCompanyName(v); touch("companyName"); }}
              error={touched.companyName ? errors.companyName : ""}
              compact
            />
          </div>

          {/* Work Email */}
          <div className="min-w-0">
            <InputField
              id="email"
              label="Work Email *"
              type="email"
              placeholder="security@utility.com"
              value={email}
              onChange={(v) => { setEmail(v); touch("email"); }}
              error={touched.email ? errors.email : ""}
              compact
            />
          </div>

          {/* Job Title */}
          <div className="min-w-0">
            <InputField
              id="job-title"
              label="Job Title / Role *"
              placeholder="OT Security Engineer"
              value={jobTitle}
              onChange={(v) => { setJobTitle(v); touch("jobTitle"); }}
              error={touched.jobTitle ? errors.jobTitle : ""}
              compact
            />
          </div>

          {/* Industry Type */}
          <EditableCombobox
            id="industry-type"
            label="Industry Type *"
            options={INDUSTRY_OPTIONS}
            value={industryType}
            onChange={(v) => { setIndustryType(v); touch("industryType"); }}
            placeholder="Type your industry..."
            error={touched.industryType ? errors.industryType : ""}
          />

          {/* Country */}
          <div className="min-w-0">
            <InputField
              id="country"
              label="Country *"
              placeholder="Egypt"
              value={country}
              onChange={(v) => { setCountry(v); touch("country"); }}
              error={touched.country ? errors.country : ""}
              compact
            />
          </div>

          {/* Infrastructure Type */}
          <EditableCombobox
            id="infrastructure-type"
            label="Infrastructure Type *"
            options={INFRA_OPTIONS}
            value={infraType}
            onChange={(v) => { setInfraType(v); touch("infraType"); }}
            placeholder="Type your infrastructure..."
            error={touched.infraType ? errors.infraType : ""}
          />

          {/* Estimated devices */}
          <div className="min-w-0">
            <InputField
              id="estimated-devices"
              label="Est. # of devices *"
              type="number"
              placeholder="120"
              value={estimatedDevices}
              onChange={(v) => { setEstimatedDevices(v); touch("estimatedDevices"); }}
              error={touched.estimatedDevices ? errors.estimatedDevices : ""}
              min={1}
              max={10_000_000}
              compact
            />
          </div>

        </div>

        {/* Purpose of Access */}
        <div>
          <span className="mb-1 block text-xs text-muted sm:text-sm">Purpose of Access *</span>
          <textarea
            id="purpose"
            value={purposeOfAccess}
            onChange={(e) => { setPurposeOfAccess(e.target.value); touch("purposeOfAccess"); }}
            placeholder="Monitoring goals, tenancy, SOC alignment — min. 20 characters."
            className={[
              TEXTAREA_CLASS,
              touched.purposeOfAccess && errors.purposeOfAccess ? "border-danger/80" : ""
            ].join(" ")}
            rows={3}
          />
          {touched.purposeOfAccess && errors.purposeOfAccess ? (
            <FieldError msg={errors.purposeOfAccess} />
          ) : null}
        </div>

        {/* Password */}
        <InputField
          id="password"
          label="Password *"
          type="password"
          placeholder="Strong password (8+ characters)"
          value={password}
          onChange={(v) => { setPassword(v); touch("password"); }}
          error={touched.password ? errors.password : ""}
          compact
        />

        {submitError ? <p className="text-xs text-danger sm:text-sm">{submitError}</p> : null}
        {submitInfo ? <p className="text-xs text-emerald-300 sm:text-sm">{submitInfo}</p> : null}

        <Button type="submit" loading={isSubmitting} className="w-full" size="md">
          Submit access request
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted sm:text-sm">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
