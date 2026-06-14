/** OT/ICS infrastructure type options for the registration form dropdown. */
export const INFRA_OPTIONS = [
  { value: "plc_network",           label: "PLC Network" },
  { value: "scada_system",          label: "SCADA System" },
  { value: "dcs",                   label: "DCS" },
  { value: "hmi_environment",       label: "HMI Environment" },
  { value: "rtu_network",           label: "RTU Network" },
  { value: "substation_automation", label: "Substation Automation" },
  { value: "industrial_iot",        label: "Industrial IoT" },
  { value: "manufacturing_line",    label: "Manufacturing Line" },
  { value: "smart_grid",            label: "Smart Grid" },
  { value: "water_treatment",       label: "Water Treatment" },
  { value: "oil_and_gas",           label: "Oil & Gas" },
  { value: "other",                 label: "Other" },
] as const;

export type InfraValue = (typeof INFRA_OPTIONS)[number]["value"];

export function formatInfra(value: string | null | undefined): string {
  if (!value) return "—";
  const row = INFRA_OPTIONS.find((o) => o.label === value || o.value === value);
  return row?.label ?? value;
}
