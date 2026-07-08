import { Suspense } from "react";
import { headers } from "next/headers";
import { getWorkspaceFromHostHeader } from "@/lib/workspace-host";
import { WorkspaceDiscoveryForm } from "./workspace-discovery-form";
import { WorkspaceLoginForm } from "./workspace-login-form";

export default async function LoginPage() {
  const headersList = await headers();
  const workspace = getWorkspaceFromHostHeader(headersList.get("host"));

  if (workspace) {
    return (
      <Suspense>
        <WorkspaceLoginForm workspace={workspace} />
      </Suspense>
    );
  }

  return <WorkspaceDiscoveryForm />;
}
