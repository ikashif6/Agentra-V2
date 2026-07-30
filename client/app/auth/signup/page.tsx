import { Suspense } from "react";
import { CreateAccountForm } from "./create-account-form";

export default function SignupPage() {
  return (
    <Suspense>
      <CreateAccountForm />
    </Suspense>
  );
}
