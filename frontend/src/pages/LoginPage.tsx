import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginUser } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { saveAuthSession } from "../lib/authSession";
import { AuthLayout } from "../layouts/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const errors = useMemo(() => {
    return {
      email: email && !email.includes("@") ? "Please enter a valid email address." : "",
      password: password && password.length < 8 ? "Password must be at least 8 characters." : ""
    };
  }, [email, password]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");

    if (errors.email || errors.password || !email || !password) {
      setSubmitError("Please fix validation errors before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = await loginUser({ email, password });
      saveAuthSession(auth);
      navigate("/dashboard");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to login right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your OT security operations workspace.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />

        {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Login
        </Button>
      </form>

      <p className="mt-5 text-sm text-muted">
        New to OT Sentinel?{" "}
        <Link to="/register" className="font-medium text-brand hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
