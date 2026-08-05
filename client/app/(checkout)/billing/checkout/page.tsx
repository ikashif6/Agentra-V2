"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import BillingCheckoutPage from "./checkout-client";

export default function BillingCheckoutRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <BillingCheckoutPage />
    </Suspense>
  );
}
