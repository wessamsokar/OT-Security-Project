import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { forgotPassword, loginUser, resetPassword, verifyEmail } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { saveAuthSession } from "../lib/authSession";
import { AuthLayout } from "../layouts/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tokenFromLink = useMemo(() => (params.get("token") ?? "").trim(), [params]);
  const initialMode = useMemo(() => {
    if (location.pathname === "/reset-password") return "reset";
    if (location.pathname === "/verify-email") return "verify";
    return "login";
  }, [location.pathname]);

  const [mode, setMode] = useState<"login" | "forgot" | "reset" | "verify">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resetToken, setResetToken] = useState(tokenFromLink);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    setResetToken(tokenFromLink);
  }, [tokenFromLink]);
  const [authInfo, setAuthInfo] = useState("");

  const errors = useMemo(() => {
    return {
      email: email && email.trim().length < 3 ? "Please enter your email or username." : "",
      password: password && password.length < 3 ? "Password must be at least 3 characters." : ""
    };
  }, [email, password]);

  const pendingApprovalBanner = useMemo(() => {
    const st = location.state as { pendingAdminApproval?: boolean } | null | undefined;
    return Boolean(st?.pendingAdminApproval);
  }, [location.state]);

  const pageCopy = useMemo(() => {
    if (mode === "forgot") {
      return {
        title: "Forgot password",
        subtitle: "Enter your account email and we will send a reset link."
      };
    }
    if (mode === "reset") {
      return {
        title: "Reset password",
        subtitle: "Set a new password for your account."
      };
    }
    if (mode === "verify") {
      return {
        title: "Verify your email",
        subtitle: "Confirm your email token to activate your account."
      };
    }
    return {
      title: "Welcome back",
      subtitle: "Sign in to your OT security operations workspace."
    };
  }, [mode]);

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
      setMode("forgot");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to request password reset right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    const token = tokenFromLink;
    if (!token) {
      setSubmitError("This page needs the reset link from your email. Use Forgot password to get a new link.");
      return;
    }
    if (newPassword.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    setAuthInfo("");
    try {
      const result = await resetPassword(token, newPassword);
      setAuthInfo(result.message);
      setMode("login");
      setNewPassword("");
      setConfirmNewPassword("");
      navigate("/login");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to reset password right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifyEmail = async () => {
    const token = tokenFromLink || resetToken.trim();
    if (!token) {
      setSubmitError("Open this page from the link in your verification email.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    setAuthInfo("");
    try {
      const result = await verifyEmail(token);
      setAuthInfo(result.message);
      setMode("login");
      setResetToken("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to verify email right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={pageCopy.title} subtitle={pageCopy.subtitle}>
      <AnimatePresence mode="wait">
        {mode === "login" ? (
          <motion.form
            key="login-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
            onSubmit={onSubmit}
            noValidate
          >
            {pendingApprovalBanner ? (
              <p className="rounded-xl border border-brand/35 bg-brand/10 px-4 py-3 text-sm leading-relaxed text-brand">
                Your registration is saved. An administrator must approve your account before you can sign in.
              </p>
            ) : null}
            <InputField
              id="email"
              label="Email or username"
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
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setAuthInfo("");
                setMode("forgot");
              }}
              className="w-full text-left text-sm text-brand hover:underline"
            >
              Forgot password?
            </button>
          </motion.form>
        ) : null}

        {mode === "forgot" ? (
          <motion.div
            key="forgot-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <InputField
              id="forgot-email"
              label="Work Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            <Button type="button" onClick={onForgotPassword} loading={isSubmitting} className="w-full" size="lg">
              Send reset link
            </Button>
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setMode("login");
                navigate("/login");
              }}
              className="w-full text-left text-sm text-brand hover:underline"
            >
              Back to login
            </button>
          </motion.div>
        ) : null}

        {mode === "reset" ? (
          <motion.div
            key="reset-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {!tokenFromLink ? (
              <p className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger">
                This page must be opened from the button in your reset email. Request a new link from Forgot password on
                the login screen.
              </p>
            ) : null}
            <InputField
              id="new-password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Enter new password (min 8 characters)"
            />
            <InputField
              id="confirm-new-password"
              label="Confirm password"
              type="password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              placeholder="Re-enter new password"
            />
            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            <Button
              type="button"
              onClick={onResetPassword}
              loading={isSubmitting}
              className="w-full"
              size="lg"
              disabled={!tokenFromLink}
            >
              Reset password
            </Button>
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setMode("login");
                navigate("/login");
              }}
              className="w-full text-left text-sm text-brand hover:underline"
            >
              Back to login
            </button>
          </motion.div>
        ) : null}

        {mode === "verify" ? (
          <motion.div
            key="verify-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {tokenFromLink ? (
              <p className="text-sm text-muted">
                Your verification link is ready. Tap the button below to confirm your email — no token to copy.
              </p>
            ) : (
              <InputField
                id="verify-token"
                label="Verification token"
                value={resetToken}
                onChange={setResetToken}
                placeholder="Only if you do not have the email link"
              />
            )}
            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            <Button
              type="button"
              onClick={onVerifyEmail}
              loading={isSubmitting}
              className="w-full"
              size="lg"
              disabled={!tokenFromLink && !resetToken.trim()}
            >
              Verify email
            </Button>
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setMode("login");
                navigate("/login");
              }}
              className="w-full text-left text-sm text-brand hover:underline"
            >
              Back to login
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
