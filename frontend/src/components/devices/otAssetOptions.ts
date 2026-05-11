/** Server-owned device.monitoring_status — UI maps labels only */
export type MonitoringStatusKey = "active" | "offline" | "suspicious" | "under_attack";

export const MONITORING_STATUS_LABELS: Record<MonitoringStatusKey, string> = {
  active: "Active",
  offline: "Offline",
  suspicious: "Suspicious",
  under_attack: "Under Attack"
};

export const ASSET_TYPE_OPTIONS = [
  { value: "PLC", label: "PLC", hint: "Programmable logic controller" },
  { value: "RTU", label: "RTU", hint: "Remote terminal unit" },
  { value: "HMI", label: "HMI", hint: "Human–machine interface" },
  { value: "SCADA_Server", label: "SCADA Server", hint: "Supervisory hosts" },
  { value: "Historian", label: "Historian", hint: "Time-series archival" },
  { value: "Gateway", label: "Gateway", hint: "Protocol / edge gateway" },
  { value: "Sensor", label: "Sensor", hint: "Intelligent sensor / IED" },
  { value: "Switch", label: "Switch", hint: "Industrial L2/L3 switching" },
  { value: "Firewall", label: "Firewall", hint: "OT / ICS firewall" },
  { value: "Other", label: "Other", hint: "Custom asset type" }
] as const;

export const CRITICALITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;

export const PROTOCOL_OPTIONS = [
  { value: "Modbus_TCP", label: "Modbus TCP", defaultPort: "502" },
  { value: "DNP3", label: "DNP3", defaultPort: "20000" },
  { value: "IEC_104", label: "IEC-104", defaultPort: "2404" },
  { value: "OPC_UA", label: "OPC-UA", defaultPort: "4840" },
  { value: "MQTT", label: "MQTT", defaultPort: "1883" },
  { value: "HTTP", label: "HTTP/HTTPS", defaultPort: "80" },
  { value: "Custom", label: "Custom / Other", defaultPort: "" }
] as const;

export const NETWORK_ZONE_OPTIONS = ["Field Network", "Control Network", "DMZ", "Corporate"] as const;

export const TRAFFIC_SOURCE_OPTIONS = ["Live Traffic", "PCAP Upload", "Log Stream", "Simulated Traffic"] as const;

export const MONITORING_MODE_OPTIONS = ["Passive", "Active"] as const;
