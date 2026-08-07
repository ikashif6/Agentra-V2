export const authPageClassName =
  "relative min-h-svh overflow-x-hidden bg-background lg:grid lg:grid-cols-2 lg:overflow-hidden";

export const authPanelClassName =
  "relative z-10 flex h-full min-h-svh flex-col bg-background px-6 pt-5 pb-0 text-foreground lg:px-8 lg:pt-6";

/** Shared 10px radius for auth inputs, groups, and primary buttons */
export const authRadiusClass = "rounded-[10px]";

/** Consistent auth field height — matches workspace login inputs */
export const authInputClassName = `${authRadiusClass} h-10 px-3`;
