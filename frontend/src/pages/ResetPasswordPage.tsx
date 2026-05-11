import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { resetPassword } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { AuthLayout } from "../layouts/AuthLayout";

function useTokenFromQuery() {
  const location = useLocation();
  return useMemo(() => (new URLSearchParams(location.search).get("token") ?? "").trim(), [location.search]);
}

/** Standalone reset view — token comes from ?token= only; not exposed as an input field. */
export function ResetPasswordPage() {
  const tokenFromUrl = useTokenFromQuery();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onReset = async () => {
    if (!tokenFromUrl) {
      setError("Open this page from the link in your reset email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await resetPassword(tokenFromUrl, newPassword);
      setSuccess(result.message);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Set a new password for your account.">
      <div className="space-y-4">
        {!tokenFromUrl ? (
          <p className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
            This page must be opened from the button in your reset email.{" "}
            <Link to="/login" className="font-medium text-brand underline">
              Back to login
            </Link>
          </p>
        ) : null}
        <InputField
          id="reset-new-password-page"
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Min 8 characters"
        />
        <InputField
          id="reset-confirm-password-page"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter password"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        <Button onClick={onReset} loading={loading} className="w-full" size="lg" disabled={!tokenFromUrl}>
          Reset password
        </Button>
      </div>
    </AuthLayout>
  );
}
