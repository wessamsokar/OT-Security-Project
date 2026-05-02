import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useMemo, useState } from "react";
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
  const tokenFromLink = params.get("token") ?? "";
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
  const [authInfo, setAuthInfo] = useState("");

  const errors = useMemo(() => {
    return {
      email: email && email.trim().length < 3 ? "Please enter your username." : "",
      password: password && password.length < 3 ? "Password must be at least 3 characters." : ""
    };
  }, [email, password]);

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
        subtitle: "Set your new password to restore access to your account."
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
      setMode("login");
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
            <InputField
              id="reset-token"
              label="Reset Token"
              value={resetToken}
              onChange={setResetToken}
              placeholder="Token from reset email"
            />
            <InputField
              id="new-password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Enter new password"
            />
            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            <Button type="button" onClick={onResetPassword} loading={isSubmitting} className="w-full" size="lg">
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
            <InputField
              id="verify-token"
              label="Verification Token"
              value={resetToken}
              onChange={setResetToken}
              placeholder="Token from verification email"
            />
            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
            <Button type="button" onClick={onVerifyEmail} loading={isSubmitting} className="w-full" size="lg">
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
