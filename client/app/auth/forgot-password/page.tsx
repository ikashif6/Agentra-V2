import { headers } from "next/headers";
import { getWorkspaceFromHostHeader } from "@/lib/workspace-host";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ForgotPasswordWorkspaceRequired } from "./forgot-password-workspace-required";

export default async function ForgotPasswordPage() {
  const headersList = await headers();
  const workspace = getWorkspaceFromHostHeader(headersList.get("host"));

  if (workspace) {
    return <ForgotPasswordForm workspace={workspace} />;
  }

  return <ForgotPasswordWorkspaceRequired />;
}
