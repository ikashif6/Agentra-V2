"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ticketApi } from "@/lib/api";
import { setTrackToken } from "@/lib/auth";

const step1Schema = z.object({
  ticket_code: z.string().min(1, "Ticket code required"),
  email: z.string().email("Valid email required"),
  subdomain: z.string().min(1, "Workspace subdomain required"),
});
type Step1Data = z.infer<typeof step1Schema>;

const step2Schema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "Digits only"),
});
type Step2Data = z.infer<typeof step2Schema>;

export default function TrackTicketPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Values, setStep1Values] = useState<Step1Data | null>(null);
  const [loading, setLoading] = useState(false);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1 = async (values: Step1Data) => {
    setLoading(true);
    try {
      await ticketApi.trackRequest({
        ticket_code: values.ticket_code.toUpperCase(),
        email: values.email,
        subdomain: values.subdomain,
      });
      setStep1Values(values);
      setStep(2);
      toast.success("OTP sent to your email");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send OTP";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onStep2 = async (values: Step2Data) => {
    if (!step1Values) return;
    setLoading(true);
    try {
      const { data } = await ticketApi.trackVerify({
        ticket_code: step1Values.ticket_code.toUpperCase(),
        email: step1Values.email,
        otp: values.otp,
        subdomain: step1Values.subdomain,
      });
      setTrackToken(data.data.trackToken);
      router.push(`/track/${step1Values.ticket_code.toUpperCase()}?subdomain=${step1Values.subdomain}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Invalid OTP";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4"
            style={{ background: "#E8470A" }}>
            {step === 1 ? <Search className="h-7 w-7 text-white" /> : <KeyRound className="h-7 w-7 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 ? "Track your ticket" : "Enter OTP"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === 1
              ? "Enter your ticket code and email to get an OTP"
              : `We sent a 6-digit code to ${step1Values?.email}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 ? (
            <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
              <div className="space-y-1">
                <Label>Workspace</Label>
                <div className="flex items-center rounded-lg border border-gray-200 focus-within:border-[#E8470A] focus-within:ring-1 focus-within:ring-[#E8470A] overflow-hidden transition-all">
                  <Input {...form1.register("subdomain")} placeholder="yourcompany"
                    className="border-0 focus-visible:ring-0 rounded-none flex-1" />
                  <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2 shrink-0">
                    .agentraa.com
                  </span>
                </div>
                {form1.formState.errors.subdomain && (
                  <p className="text-xs text-red-500">{form1.formState.errors.subdomain.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ticket code</Label>
                <Input {...form1.register("ticket_code")} placeholder="TKT-00001"
                  className="uppercase focus-visible:ring-[#E8470A]" />
                {form1.formState.errors.ticket_code && (
                  <p className="text-xs text-red-500">{form1.formState.errors.ticket_code.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Your email</Label>
                <Input type="email" {...form1.register("email")} placeholder="you@email.com"
                  className="focus-visible:ring-[#E8470A]" />
                {form1.formState.errors.email && (
                  <p className="text-xs text-red-500">{form1.formState.errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full font-semibold" disabled={loading}
                style={{ background: "#E8470A" }}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
              <div className="space-y-1">
                <Label>6-digit OTP</Label>
                <Input {...form2.register("otp")} placeholder="••••••" maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono focus-visible:ring-[#E8470A]" />
                {form2.formState.errors.otp && (
                  <p className="text-xs text-red-500">{form2.formState.errors.otp.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full font-semibold" disabled={loading}
                style={{ background: "#E8470A" }}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                View Ticket
              </Button>

              <button type="button" onClick={() => setStep(1)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
                ← Use a different email or ticket code
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          Your support team uses Agentraa •{" "}
          <a href="/auth/login" className="text-[#E8470A] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
