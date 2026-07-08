import { cn } from "@/lib/utils";

type SpamIconProps = {
  className?: string;
};

export function SpamIcon({ className }: SpamIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M12 9V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.29 3.86L1.82 18C1.41353 18.8049 1.99239 20 3 20H21C22.0076 20 22.5865 18.8049 22.18 18L13.71 3.86C13.3132 3.14769 12.6868 3.14769 12.29 3.86Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
