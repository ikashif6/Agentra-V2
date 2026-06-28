"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2, Eye, EyeOff, Zap, Star, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingApi } from "@/lib/api";
import { Plan } from "@/lib/types";
import { setTokens, setSubdomain, setUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─── Step 1 Schema ────────────────────────────────────────────────────────────
const step1Schema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  subdomain: z.string()
    .min(2, "At least 2 characters")
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Lowercase letters, numbers, hyphens only"),
  firstName: z.string().min(1, "First name required").max(50),
  lastName: z.string().min(1, "Last name required").max(50),
  email: z.string().email("Valid email required"),
  password: z.string()
    .min(8, "At least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must include upper, lower, and number"),
});
type Step1Data = z.infer<typeof step1Schema>;

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  pro: <Star className="h-5 w-5" />,
  enterprise: <Building2 className="h-5 w-5" />,
};

const PLAN_PRICES: Record<string, string> = {
  starter: "$29/mo",
  pro: "$79/mo",
  enterprise: "Custom",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  });

  const subdomainValue = watch("subdomain");

  // Debounce subdomain check
  useEffect(() => {
    if (!subdomainValue || subdomainValue.length < 2) { setSubdomainStatus("idle"); return; }
    const timer = setTimeout(async () => {
      setSubdomainStatus("checking");
      try {
        const { data } = await onboardingApi.checkSubdomain(subdomainValue);
        setSubdomainStatus(data.data.available ? "available" : "taken");
      } catch {
        setSubdomainStatus("idle");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [subdomainValue]);

  useEffect(() => {
    onboardingApi.getPlans().then(({ data }) => setPlans(data.data.plans)).catch(() => {});
  }, []);

  const onStep1Submit = (values: Step1Data) => {
    setStep1Data(values);
    setStep(2);
  };

  const handleFinish = async () => {
    if (!step1Data) return;
    setSubmitting(true);
    try {
      const { data } = await onboardingApi.onboard({
        ...step1Data,
        plan_id: selectedPlan,
        billingCycle,
      });
      toast.success("Workspace created! Please verify your email.");

      // If tokens returned (auto-login), use them
      if (data.data?.accessToken) {
        setTokens(data.data.accessToken, data.data.refreshToken);
        setSubdomain(step1Data.subdomain);
        setUser(data.data.user);
        router.push("/dashboard");
      } else {
        router.push(`/auth/login?onboarded=1&subdomain=${step1Data.subdomain}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #E8470A 0%, #C73A08 60%, #1a0a04 100%)" }}>
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-10 bg-white" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">Agentraa</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-8">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                    step >= s ? "bg-white text-[#E8470A]" : "bg-white/20 text-white/60"
                  )}>
                    {step > s ? <Check className="h-4 w-4" /> : s}
                  </div>
                  <span className={cn("text-sm", step >= s ? "text-white" : "text-white/40")}>
                    {s === 1 ? "Your details" : "Choose plan"}
                  </span>
                  {s < 2 && <ChevronRight className="h-4 w-4 text-white/30" />}
                </div>
              ))}
            </div>
          </div>

          <h1 className="text-white text-4xl font-bold leading-tight">
            {step === 1 ? <>Set up your<br />workspace</> : <>Pick your<br />plan</>}
          </h1>
          <p className="text-white/60 text-lg">
            {step === 1
              ? "Takes less than 2 minutes. No credit card required."
              : "14-day free trial on any plan. Cancel anytime."}
          </p>
        </div>

        <div className="relative z-10 border-l-2 border-white/20 pl-4">
          <p className="text-white/60 text-sm italic">"Up and running in minutes."</p>
          <p className="text-white/40 text-xs mt-1">— Happy customer</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E8470A" }}>
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl">Agentraa</span>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create your workspace</h2>
                <p className="mt-1 text-sm text-gray-500">Step 1 of 2 — Company &amp; admin details</p>
              </div>

              <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-4">
                <div className="space-y-1">
                  <Label>Company name</Label>
                  <Input {...register("companyName")} placeholder="Acme Corp"
                    className="focus-visible:ring-[#E8470A]" />
                  {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Workspace URL</Label>
                  <div className="flex items-center rounded-lg border border-gray-200 focus-within:border-[#E8470A] focus-within:ring-1 focus-within:ring-[#E8470A] overflow-hidden transition-all">
                    <Input {...register("subdomain")} placeholder="acme"
                      className="border-0 focus-visible:ring-0 rounded-none flex-1 lowercase" />
                    <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2 shrink-0">
                      .agentraa.com
                    </span>
                  </div>
                  {subdomainStatus === "checking" && <p className="text-xs text-gray-400">Checking availability...</p>}
                  {subdomainStatus === "available" && <p className="text-xs text-green-600">✓ Available</p>}
                  {subdomainStatus === "taken" && <p className="text-xs text-red-500">✗ Already taken</p>}
                  {errors.subdomain && <p className="text-xs text-red-500">{errors.subdomain.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>First name</Label>
                    <Input {...register("firstName")} placeholder="Jane"
                      className="focus-visible:ring-[#E8470A]" />
                    {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Last name</Label>
                    <Input {...register("lastName")} placeholder="Doe"
                      className="focus-visible:ring-[#E8470A]" />
                    {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} placeholder="jane@acme.com"
                    className="focus-visible:ring-[#E8470A]" />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPwd ? "text" : "password"} {...register("password")}
                      placeholder="••••••••" className="pr-10 focus-visible:ring-[#E8470A]" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>

                <Button type="submit" className="w-full font-semibold mt-2" style={{ background: "#E8470A" }}>
                  Next: Choose your plan <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500">
                Already have a workspace?{" "}
                <a href="/auth/login" className="text-[#E8470A] font-medium hover:underline">Sign in</a>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Choose your plan</h2>
                <p className="mt-1 text-sm text-gray-500">Step 2 of 2 — 14-day free trial, cancel anytime</p>
              </div>

              {/* Billing toggle */}
              <div className="flex items-center gap-3 p-1 bg-gray-100 rounded-lg w-fit">
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <button key={cycle} onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                      billingCycle === cycle ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    )}>
                    {cycle === "monthly" ? "Monthly" : "Yearly (save 20%)"}
                  </button>
                ))}
              </div>

              {/* Plan cards */}
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button key={plan.plan_id} onClick={() => setSelectedPlan(plan.plan_id)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all",
                      selectedPlan === plan.plan_id
                        ? "border-[#E8470A] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center",
                          selectedPlan === plan.plan_id ? "bg-[#E8470A] text-white" : "bg-gray-100 text-gray-500"
                        )}>
                          {PLAN_ICONS[plan.plan_id]}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 capitalize">{plan.plan_id}</div>
                          <div className="text-xs text-gray-500">
                            Up to {plan.maxUsers === 99999 ? "unlimited" : plan.maxUsers} users
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{PLAN_PRICES[plan.plan_id]}</div>
                        {selectedPlan === plan.plan_id && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center ml-auto mt-1"
                            style={{ background: "#E8470A" }}>
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {Object.entries(plan.features)
                        .filter(([, v]) => v)
                        .map(([key]) => (
                          <span key={key} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                            {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                          </span>
                        ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleFinish} disabled={submitting}
                  className="flex-1 font-semibold" style={{ background: "#E8470A" }}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create workspace
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
