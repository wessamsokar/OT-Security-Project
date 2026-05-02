import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { resetPassword } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { AuthLayout } from "../layouts/AuthLayout";

function useInitialToken() {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") ?? "";
  }, [location.search]);
}

export function ResetPasswordPage() {
  const initialToken = useInitialToken();
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onReset = async () => {
    if (!token.trim() || newPassword.length < 8) {
      setError("Token and new password (min 8 chars) are required.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await resetPassword(token.trim(), newPassword);
      setSuccess(result.message);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Use the token received by email to set a new password.">
      <div className="space-y-4">
        <InputField
          id="reset-token-page"
          label="Reset token"
          value={token}
          onChange={setToken}
          placeholder="Paste token here"
        />
        <InputField
          id="reset-new-password-page"
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Enter new password"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        <Button onClick={onReset} loading={loading} className="w-full" size="lg">
          Reset password
        </Button>
      </div>
    </AuthLayout>
  );
}
