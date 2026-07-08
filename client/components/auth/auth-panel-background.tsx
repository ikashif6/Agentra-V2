export const authPageClassName =
  "grid h-svh max-h-svh overflow-hidden lg:grid-cols-2";

export const authPanelClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-background p-6 text-foreground lg:p-8";

/** Shared 10px radius for auth inputs, groups, and primary buttons */
export const authRadiusClass = "rounded-[10px]";

/** Consistent auth field height — matches workspace login inputs */
export const authInputClassName = `${authRadiusClass} h-10 px-3`;
