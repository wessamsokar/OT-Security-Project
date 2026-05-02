import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { verifyEmail } from "../api/authApi";
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

export function VerifyEmailPage() {
  const initialToken = useInitialToken();
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onVerify = async () => {
    if (!token.trim()) {
      setError("Verification token is required.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await verifyEmail(token.trim());
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify email right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle="Paste token from email or open the verification link directly.">
      <div className="space-y-4">
        <InputField
          id="verify-token"
          label="Verification token"
          value={token}
          onChange={setToken}
          placeholder="Paste token here"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        <Button onClick={onVerify} loading={loading} className="w-full" size="lg">
          Verify email
        </Button>
      </div>
    </AuthLayout>
  );
}
