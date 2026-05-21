import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { forgotPassword, registerUser } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import type { IndustryValue } from "../lib/industryOptions";
import { INDUSTRY_OPTIONS } from "../lib/industryOptions";
import { AuthLayout } from "../layouts/AuthLayout";

const SELECT_CLASS =
  "w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20";

const TEXTAREA_CLASS =
  "min-h-[4.25rem] w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm leading-snug text-text outline-none transition placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20 sm:min-h-[3.75rem]";

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [industryType, setIndustryType] = useState<IndustryValue>("industrial_automation");
  const [infrastructureType, setInfrastructureType] = useState("");
  const [estimatedDevices, setEstimatedDevices] = useState("");
  const [country, setCountry] = useState("");
  const [purposeOfAccess, setPurposeOfAccess] = useState("");
  const [operatesOtIcs, setOperatesOtIcs] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");

  const errors = useMemo(() => {
    const n = parseInt(estimatedDevices.trim(), 10);
    const devOk =
      estimatedDevices.trim() !== "" &&
      Number.isFinite(n) &&
      n >= 1 &&
      n <= 10_000_000;
    return {
      fullName: fullName && fullName.trim().length < 3 ? "Minimum 3 characters." : "",
      companyName: companyName && companyName.trim().length < 2 ? "Minimum 2 characters." : "",
      email: email && !email.includes("@") ? "Please enter a valid work email." : "",
      jobTitle: jobTitle && jobTitle.trim().length < 2 ? "Minimum 2 characters." : "",
      infrastructureType:
        infrastructureType && infrastructureType.trim().length < 2 ? "Describe your infrastructure scope." : "",
      estimatedDevices:
        estimatedDevices.trim() !== "" && !devOk ? "Enter a realistic device count (1–10,000,000)." : "",
      country: country && country.trim().length < 2 ? "Minimum 2 characters." : "",
      purposeOfAccess:
        purposeOfAccess && purposeOfAccess.trim().length < 20 ? "Purpose must be at least 20 characters." : "",
      password: password && password.length < 8 ? "Minimum 8 characters." : "",
      ot: operatesOtIcs === null ? "Please select Yes or No." : ""
    };
  }, [
    fullName,
    companyName,
    email,
    jobTitle,
    infrastructureType,
    estimatedDevices,
    country,
    purposeOfAccess,
    password,
    operatesOtIcs
  ]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitInfo("");

    const n = parseInt(estimatedDevices.trim(), 10);
    const ot = operatesOtIcs;
    if (
      errors.fullName ||
      errors.companyName ||
      errors.email ||
      errors.jobTitle ||
      errors.infrastructureType ||
      errors.country ||
      errors.purposeOfAccess ||
      errors.password ||
      errors.ot ||
      !fullName.trim() ||
      !companyName.trim() ||
      !email.trim() ||
      !jobTitle.trim() ||
      !infrastructureType.trim() ||
      !country.trim() ||
      !purposeOfAccess.trim() ||
      !password ||
      ot === null ||
      !estimatedDevices.trim() ||
      !Number.isFinite(n) ||
      n < 1
    ) {
      setSubmitError("Please fix the highlighted fields and complete all requirements.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({
        fullName,
        companyName,
        email,
        jobTitle,
        industryType,
        infrastructureType,
        estimatedDeviceCount: n,
        country,
        purposeOfAccess,
        operatesOtIcs: ot,
        password
      });
      try {
        await forgotPassword(email.trim());
      } catch {
        // optional
      }
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
          <InputField
            id="full-name"
            label="Full Name *"
            placeholder="Jane Doe"
            value={fullName}
            onChange={setFullName}
            error={errors.fullName}
            compact
          />
          <InputField
            id="company-name"
            label="Company Name *"
            placeholder="ACME Utilities"
            value={companyName}
            onChange={setCompanyName}
            error={errors.companyName}
            compact
          />
          <InputField
            id="email"
            label="Work Email *"
            type="email"
            placeholder="security@utility.com"
            value={email}
            onChange={setEmail}
            error={errors.email}
            compact
          />
          <InputField
            id="job-title"
            label="Job Title / Role *"
            placeholder="OT Security Engineer"
            value={jobTitle}
            onChange={setJobTitle}
            error={errors.jobTitle}
            compact
          />
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted sm:text-sm">Industry Type *</span>
            <select
              id="industry-type"
              value={industryType}
              onChange={(e) => setIndustryType(e.target.value as IndustryValue)}
              className={SELECT_CLASS}
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <InputField
            id="country"
            label="Country *"
            placeholder="Egypt"
            value={country}
            onChange={setCountry}
            error={errors.country}
            compact
          />
          <div className="sm:col-span-2">
            <InputField
              id="infrastructure-type"
              label="Infrastructure Type *"
              placeholder="e.g. Modbus TCP, IEC-61850 substations, PLC islands"
              value={infrastructureType}
              onChange={setInfrastructureType}
              error={errors.infrastructureType}
              compact
            />
          </div>
          <InputField
            id="estimated-devices"
            label="Est. # of devices *"
            type="number"
            placeholder="120"
            value={estimatedDevices}
            onChange={setEstimatedDevices}
            error={errors.estimatedDevices}
            min={1}
            max={10_000_000}
            compact
          />
          <fieldset className="min-w-0 border-0 p-0 sm:col-span-1">
            <legend className="mb-1 block text-xs font-normal text-muted sm:text-sm">
              Operates OT/ICS infrastructure? *
            </legend>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-[#0c152d]/45 px-2.5 py-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text sm:text-sm">
                <input
                  type="radio"
                  name="operates_ot"
                  className="h-3.5 w-3.5 shrink-0 border-white/25 bg-[#0c152d]/80 text-brand accent-brand"
                  checked={operatesOtIcs === true}
                  onChange={() => setOperatesOtIcs(true)}
                />
                Yes
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text sm:text-sm">
                <input
                  type="radio"
                  name="operates_ot"
                  className="h-3.5 w-3.5 shrink-0 border-white/25 bg-[#0c152d]/80 text-brand accent-brand"
                  checked={operatesOtIcs === false}
                  onChange={() => setOperatesOtIcs(false)}
                />
                No
              </label>
            </div>
            {errors.ot ? <p className="mt-0.5 text-xs text-danger">{errors.ot}</p> : null}
          </fieldset>
        </div>

        <div>
          <span className="mb-1 block text-xs text-muted sm:text-sm">Purpose of Access *</span>
          <textarea
            id="purpose"
            value={purposeOfAccess}
            onChange={(e) => setPurposeOfAccess(e.target.value)}
            placeholder="Monitoring goals, tenancy, SOC alignment — min. 20 characters."
            className={[
              TEXTAREA_CLASS,
              errors.purposeOfAccess ? "border-danger/80" : ""
            ].join(" ")}
            rows={3}
          />
          {errors.purposeOfAccess ? <p className="mt-0.5 text-xs text-danger">{errors.purposeOfAccess}</p> : null}
        </div>

        <InputField
          id="password"
          label="Password *"
          type="password"
          placeholder="Strong password (8+ characters)"
          value={password}
          onChange={setPassword}
          error={errors.password}
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
