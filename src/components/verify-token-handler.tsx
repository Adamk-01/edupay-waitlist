"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VerificationStateView, VerificationState } from "@/components/verification-state";
import { verifyWaitlistToken, waitlistApiConfig } from "@/lib/waitlist-api";

/**
 * Consumes the `?token=` query parameter from the verification email.
 *
 * If there is no token, or the API is not configured for this environment, the
 * generic "check your email" instructions are shown instead of firing a
 * request that can only fail.
 */
export function VerifyTokenHandler() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerificationState>("in_progress");

  useEffect(() => {
    if (!token || !waitlistApiConfig.baseUrl) return;

    let cancelled = false;

    verifyWaitlistToken(token)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        // A failed lookup leaves the visitor on the instruction screen rather
        // than an error; retrying the link is the recovery path.
        if (!cancelled) setState("in_progress");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return <VerificationStateView state={state} />;
}
