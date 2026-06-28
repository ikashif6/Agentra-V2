import {
  authPageClassName,
  authPanelClassName,
} from "@/components/auth/auth-panel-background";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AuthLogo } from "@/components/auth/auth-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={authPageClassName}>
      <div className={authPanelClassName}>
        <div className="relative z-10 shrink-0">
          <AuthLogo />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-2">
          <div className="w-full max-w-sm space-y-5">{children}</div>
        </div>

        <AuthLegalFooter />
      </div>

      <AuthHeroPanel />
    </div>
  );
}
