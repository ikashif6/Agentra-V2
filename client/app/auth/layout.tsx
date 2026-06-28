export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left — branding panel (30% brand color) */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #E8470A 0%, #C73A08 60%, #1a0a04 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute top-1/3 -right-12 w-48 h-48 rounded-full opacity-5 bg-white" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">Agentraa</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-white text-4xl font-bold leading-tight">
            Customer support,<br />
            <span className="text-white/70">reimagined.</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-sm">
            One platform for every team. Tickets, departments, and customers — all in one place.
          </p>

          {/* Stats row */}
          <div className="flex gap-8 pt-4">
            {[["10k+", "Tickets resolved"], ["500+", "Teams onboarded"], ["99.9%", "Uptime"]].map(([val, label]) => (
              <div key={label}>
                <div className="text-white text-2xl font-bold">{val}</div>
                <div className="text-white/50 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 border-l-2 border-white/20 pl-4">
          <p className="text-white/60 text-sm italic">
            "Agentraa transformed how we handle customer support."
          </p>
          <p className="text-white/40 text-xs mt-1">— Customer success team</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#E8470A" }}>
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl">Agentraa</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
