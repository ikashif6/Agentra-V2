export const authPageClassName =
  "grid h-svh max-h-svh overflow-hidden lg:grid-cols-2";

export const authPanelClassName =
  "relative flex h-full min-h-0 flex-col overflow-hidden bg-background px-6 pt-5 pb-0 text-foreground lg:px-8 lg:pt-6";

/** Shared 10px radius for auth inputs, groups, and primary buttons */
export const authRadiusClass = "rounded-[10px]";

/** Consistent auth field height — matches workspace login inputs */
export const authInputClassName = `${authRadiusClass} h-10 px-3`;
