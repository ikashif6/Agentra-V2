import { LoginVisualBackground } from "./login-visual-background";
import { WorkspaceScene } from "./workspace/workspace-scene";

export function LoginVisualPanel() {
  return (
    <div className="login-visual-panel relative hidden h-full min-h-0 overflow-hidden lg:block">
      <LoginVisualBackground />

      <div className="relative z-10 flex h-full min-h-0 items-center justify-center px-4 py-8 lg:px-6 xl:px-8">
        <div className="login-visual-workspace-scroll w-full max-w-[min(100%,720px)] overflow-x-hidden">
          <WorkspaceScene />
        </div>
      </div>
    </div>
  );
}
