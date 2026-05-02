import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { forgotPassword, registerUser } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { AuthLayout } from "../layouts/AuthLayout";

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitInfo, setSubmitInfo] = useState("");

  const errors = useMemo(() => {
    return {
      fullName: fullName && fullName.trim().length < 3 ? "Please enter your full name." : "",
      email: email && !email.includes("@") ? "Please enter a valid email address." : "",
      password: password && password.length < 8 ? "Password must be at least 8 characters." : ""
    };
  }, [fullName, email, password]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitInfo("");

    if (errors.fullName || errors.email || errors.password || !fullName || !email || !password) {
      setSubmitError("Please complete all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({ fullName, email, password });
      try {
        await forgotPassword(email.trim());
      } catch {
        // no-op: registration success should not fail due to email transport
      }
      setSubmitInfo("Account created. Verification/reset token email has been sent.");
      navigate("/login");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create account right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Set up your OT threat monitoring workspace.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <InputField
          id="full-name"
          label="Full Name"
          placeholder="Alex Morgan"
          value={fullName}
          onChange={setFullName}
          error={errors.fullName}
        />

        <InputField
          id="email"
          label="Work Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />

        <InputField
          id="password"
          label="Password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
        {submitInfo ? <p className="text-sm text-emerald-300">{submitInfo}</p> : null}

        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
