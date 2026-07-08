function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function formatTimezoneLabel(timeZone: string, date = new Date()): string {
  try {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "longOffset",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? "UTC";

    const normalizedOffset = offset.replace("GMT", "UTC");
    return `(${normalizedOffset}) ${timeZone}`;
  } catch {
    return timeZone;
  }
}

export function getTimezoneOptions(): { value: string; label: string }[] {
  const browserTz = getBrowserTimezone();
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [browserTz, "UTC", "America/New_York", "Europe/London", "Asia/Karachi"];

  const unique = Array.from(new Set([browserTz, ...zones])).sort((a, b) =>
    formatTimezoneLabel(a).localeCompare(formatTimezoneLabel(b)),
  );

  return unique.map((value) => ({
    value,
    label: formatTimezoneLabel(value),
  }));
}
