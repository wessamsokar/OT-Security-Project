import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { forgotPassword, loginUser, resetPassword, verifyEmail } from "../api/authApi";
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authInfo, setAuthInfo] = useState("");

  const errors = useMemo(() => {
    return {
      email: email && email.trim().length < 3 ? "Please enter your username." : "",
      password: password && password.length < 3 ? "Password must be at least 3 characters." : ""
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

  const onForgotPassword = async () => {
    if (!email.trim()) {
      setSubmitError("Please enter your email first.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    setAuthInfo("");
    try {
      const result = await forgotPassword(email.trim());
      setAuthInfo(result.message);
      setShowForgotPassword(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to request password reset right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    if (!resetToken.trim() || newPassword.length < 8) {
      setSubmitError("Enter a valid token and a new password (min 8 chars).");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    setAuthInfo("");
    try {
      const result = await resetPassword(resetToken.trim(), newPassword);
      setAuthInfo(result.message);
      setShowForgotPassword(false);
      setResetToken("");
      setNewPassword("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to reset password right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifyEmail = async () => {
    if (!resetToken.trim()) {
      setSubmitError("Enter verification token first.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    setAuthInfo("");
    try {
      const result = await verifyEmail(resetToken.trim());
      setAuthInfo(result.message);
      setResetToken("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to verify email right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your OT security operations workspace.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <InputField
          id="email"
          label="Username"
          placeholder="admin"
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
        <button
          type="button"
          onClick={onForgotPassword}
          className="w-full text-left text-sm text-brand hover:underline"
        >
          Forgot password?
        </button>
      </form>

      {showForgotPassword ? (
        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <InputField
            id="reset-token"
            label="Reset/Verification Token"
            value={resetToken}
            onChange={setResetToken}
            placeholder="Paste token from email"
          />
          <InputField
            id="new-password"
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onResetPassword} loading={isSubmitting} size="sm">
              Reset password
            </Button>
            <Button type="button" variant="outline" onClick={onVerifyEmail} loading={isSubmitting} size="sm">
              Verify email token
            </Button>
          </div>
        </div>
      ) : null}

      {authInfo ? <p className="mt-3 text-sm text-emerald-300">{authInfo}</p> : null}

      <p className="mt-5 text-sm text-muted">
        New to OT Sentinel?{" "}
        <Link to="/register" className="font-medium text-brand hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}
