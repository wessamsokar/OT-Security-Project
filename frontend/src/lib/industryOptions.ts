/** Values match backend `IndustryType` enum (`app.models.user`). */
export const INDUSTRY_OPTIONS = [
  { value: "power_distribution", label: "Power Distribution" },
  { value: "smart_grid", label: "Smart Grid" },
  { value: "industrial_automation", label: "Industrial Automation" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "other", label: "Other" }
] as const;

export type IndustryValue = (typeof INDUSTRY_OPTIONS)[number]["value"];

export function formatIndustry(value: string | null | undefined): string {
  if (!value) return "—";
  const row = INDUSTRY_OPTIONS.find((o) => o.value === value);
  return row?.label ?? value;
}
