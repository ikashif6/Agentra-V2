import { LoginVisualBackground } from "./login-visual-background";
import { WorkspaceScene } from "./workspace/workspace-scene";

export function LoginVisualPanel() {
  return (
    <div className="login-visual-panel relative hidden h-full min-h-0 lg:block">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <LoginVisualBackground />
      </div>

      <div className="relative z-10 box-border flex h-full min-h-0 items-center justify-center overflow-visible px-6 py-6 lg:px-8 lg:py-7 xl:px-10 xl:py-8">
        <div className="login-visual-workspace-fit mx-auto w-full max-w-[min(100%,660px)]">
          <WorkspaceScene />
        </div>
      </div>
    </div>
  );
}
