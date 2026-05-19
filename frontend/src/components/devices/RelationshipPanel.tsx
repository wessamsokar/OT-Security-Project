/**
 * RelationshipPanel — topology-aware edge manager embedded in the device modal.
 *
 * Responsibilities:
 * - Edit mode: loads current topology_edges for the device on mount.
 * - Shows persisted edges as removable relationship chips.
 * - Provides an "Add relationship" row (searchable device selector + type).
 * - Edit mode:  mutations fire immediately against the API.
 * - Create mode: mutations are buffered and flushed after the device is created.
 *   Parent calls flushPendingEdges(newDeviceId) from the ref exposed via onPanelRef.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { GitBranch, Network, Plus, X, Search, Loader2, AlertCircle } from "lucide-react";

import type { DeviceResponse } from "../../api/devicesApi";
import type { TopologyEdgeRecord, TopologyRelationshipType } from "../../api/topologyApi";
import { createTopologyEdge, deleteTopologyEdge, fetchEdgesForDevice } from "../../api/topologyApi";

// ─── constants ────────────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES: { value: TopologyRelationshipType; label: string; desc: string }[] = [
  { value: "connected_to", label: "Connected to", desc: "Direct network link" },
  { value: "upstream",     label: "Upstream",     desc: "Traffic flows from this device" },
  { value: "downstream",   label: "Downstream",   desc: "Traffic flows to this device" },
  { value: "peer",         label: "Peer",         desc: "Same-level peer device" },
  { value: "parent",       label: "Parent",       desc: "Hierarchically above this device" },
];

const TYPE_CHIP_CLASS: Record<TopologyRelationshipType, string> = {
  connected_to: "border-violet-500/40 bg-violet-500/15 text-violet-200",
  upstream:     "border-sky-500/40   bg-sky-500/15   text-sky-200",
  downstream:   "border-sky-400/40   bg-sky-400/15   text-sky-300",
  peer:         "border-teal-500/40  bg-teal-500/15  text-teal-200",
  parent:       "border-amber-500/40 bg-amber-500/15 text-amber-200",
};

const SELECT_ROW =
  "w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm text-white outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20 disabled:opacity-40";

// ─── types ────────────────────────────────────────────────────────────────────

/** Buffered edge — created before the device exists (create-mode only). */
type PendingEdge = {
  /** Temp local id for list keying. */
  localId: string;
  targetDeviceId: number;
  targetName: string;
  relationshipType: TopologyRelationshipType;
};

export type RelationshipPanelRef = {
  /** Flush buffered edges after device creation. Returns edge IDs created. */
  flushPendingEdges: (sourceDeviceId: number) => Promise<number[]>;
};

type Props = {
  /** null = create mode; number = edit mode. */
  deviceId: number | null;
  existingDevices: DeviceResponse[];
  onEdgesChanged?: () => void;
  /** Called with the panel's imperative ref so DevicesPage can call flushPendingEdges. */
  onPanelRef?: (ref: RelationshipPanelRef) => void;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function relLabel(type: TopologyRelationshipType): string {
  return RELATIONSHIP_TYPES.find((r) => r.value === type)?.label ?? type;
}

function directionLabel(dir: string): string {
  if (dir === "forward")       return "→";
  if (dir === "reverse")       return "←";
  return "↔";
}

// ─── component ────────────────────────────────────────────────────────────────

export function RelationshipPanel({ deviceId, existingDevices, onEdgesChanged, onPanelRef }: Props) {
  const isEditMode = deviceId !== null;

  // persisted edges (edit mode)
  const [edges, setEdges]           = useState<TopologyEdgeRecord[]>([]);
  // pending edges (create mode)
  const [pending, setPending]       = useState<PendingEdge[]>([]);

  const [loadingEdges, setLoadingEdges]   = useState(false);
  const [loadError, setLoadError]         = useState("");
  const [removing, setRemoving]           = useState<number | null>(null);   // edge id being deleted
  const [addError, setAddError]           = useState("");
  const [adding, setAdding]               = useState(false);

  // add-row state
  const [search, setSearch]             = useState("");
  const [selDeviceId, setSelDeviceId]   = useState("");
  const [selType, setSelType]           = useState<TopologyRelationshipType>("connected_to");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef                       = useRef<HTMLInputElement>(null);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // ── filtered device list (exclude self + already-related) ──────────────────
  const candidateDevices = existingDevices.filter((d) => {
    if (d.id === deviceId) return false;
    // exclude already-wired devices (either side)
    const alreadyPersisted = edges.some(
      (e) => e.source_device_id === d.id || e.target_device_id === d.id
    );
    const alreadyPending = pending.some((p) => p.targetDeviceId === d.id);
    return !alreadyPersisted && !alreadyPending;
  });

  const filteredDevices = search.trim()
    ? candidateDevices.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.ip_address ?? "").includes(search)
      )
    : candidateDevices;

  // ── load existing edges (edit mode only) ──────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    let active = true;
    setLoadingEdges(true);
    setLoadError("");
    fetchEdgesForDevice(deviceId)
      .then((rows) => { if (active) { setEdges(rows); } })
      .catch((err) => { if (active) setLoadError(err instanceof Error ? err.message : "Failed to load relationships."); })
      .finally(() => { if (active) setLoadingEdges(false); });
    return () => { active = false; };
  }, [deviceId, isEditMode]);

  // ── expose imperative ref ─────────────────────────────────────────────────
  useEffect(() => {
    if (!onPanelRef) return;
    onPanelRef({
      flushPendingEdges: async (sourceDeviceId: number) => {
        const created: number[] = [];
        for (const p of pending) {
          try {
            const edge = await createTopologyEdge({
              source_device_id: sourceDeviceId,
              target_device_id: p.targetDeviceId,
              relationship_type: p.relationshipType,
              direction: "bidirectional",
            });
            created.push(edge.id);
          } catch {
            // best-effort; don't block device creation
          }
        }
        setPending([]);
        if (created.length > 0) onEdgesChanged?.();
        return created;
      },
    });
  }, [pending, onEdgesChanged, onPanelRef]);

  // ── close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleSelectDevice = useCallback((d: DeviceResponse) => {
    setSelDeviceId(String(d.id));
    setSearch(d.name);
    setShowDropdown(false);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!selDeviceId) { setAddError("Select a target device."); return; }
    const targetId = Number(selDeviceId);
    setAddError("");

    if (isEditMode) {
      // fire immediately
      setAdding(true);
      try {
        const edge = await createTopologyEdge({
          source_device_id: deviceId,
          target_device_id: targetId,
          relationship_type: selType,
          direction: "bidirectional",
        });
        setEdges((prev) => [...prev, edge]);
        setSelDeviceId("");
        setSearch("");
        onEdgesChanged?.();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Failed to add relationship.");
      } finally {
        setAdding(false);
      }
    } else {
      // buffer for later
      const target = existingDevices.find((d) => d.id === targetId);
      if (!target) return;
      const localId = `pending-${Date.now()}-${Math.random()}`;
      setPending((prev) => [...prev, { localId, targetDeviceId: targetId, targetName: target.name, relationshipType: selType }]);
      setSelDeviceId("");
      setSearch("");
    }
  }, [selDeviceId, selType, isEditMode, deviceId, existingDevices, onEdgesChanged]);

  const handleRemovePersisted = useCallback(async (edge: TopologyEdgeRecord) => {
    setRemoving(edge.id);
    try {
      await deleteTopologyEdge(edge.id);
      setEdges((prev) => prev.filter((e) => e.id !== edge.id));
      onEdgesChanged?.();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to remove relationship.");
    } finally {
      setRemoving(null);
    }
  }, [onEdgesChanged]);

  const handleRemovePending = useCallback((localId: string) => {
    setPending((prev) => prev.filter((p) => p.localId !== localId));
  }, []);

  // ── render helpers ────────────────────────────────────────────────────────
  const hasAny = edges.length > 0 || pending.length > 0;
  const hasDevices = existingDevices.filter((d) => d.id !== deviceId).length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4">
      {/* Section header */}
      <div className="mb-1 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-[0_0_16px_rgba(168,85,247,0.2)]">
          <Network size={18} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-white">Network relationships</h3>
          <p className="text-xs text-muted">
            Define how this device connects to the rest of the OT topology. Edges persist in the topology graph.
          </p>
        </div>
      </div>

      {/* Loading / error */}
      {loadingEdges && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 size={13} className="animate-spin" />
          Loading relationships…
        </div>
      )}
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertCircle size={13} />
          {loadError}
        </div>
      )}

      {/* Empty state */}
      {!loadingEdges && !hasDevices && (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-center text-xs text-muted">
          <GitBranch size={16} className="mx-auto mb-1.5 opacity-40" />
          No other devices registered yet.<br />
          <span className="opacity-70">Register additional assets first, then define relationships.</span>
        </div>
      )}

      {/* Existing / pending chips */}
      {hasAny && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Current relationships">
          {/* Persisted edges */}
          {edges.map((edge) => {
            const isSource = edge.source_device_id === deviceId;
            const peerName = isSource ? (edge.target_name ?? `ID ${edge.target_device_id}`) : (edge.source_name ?? `ID ${edge.source_device_id}`);
            const chipClass = TYPE_CHIP_CLASS[edge.relationship_type as TopologyRelationshipType] ?? "border-white/20 bg-white/5 text-muted";
            const isRemoving = removing === edge.id;
            return (
              <div
                key={edge.id}
                role="listitem"
                className={[
                  "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  chipClass,
                  isRemoving ? "opacity-50" : "hover:border-white/30"
                ].join(" ")}
              >
                <span className="opacity-70">{directionLabel(edge.direction)}</span>
                <span className="font-semibold">{relLabel(edge.relationship_type as TopologyRelationshipType)}</span>
                <span className="opacity-70">→</span>
                <span>{peerName}</span>
                {edge.edge_source === "manual" && (
                  <button
                    type="button"
                    onClick={() => handleRemovePersisted(edge)}
                    disabled={isRemoving}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full opacity-50 transition hover:bg-white/20 hover:opacity-100 disabled:cursor-not-allowed"
                    aria-label={`Remove ${relLabel(edge.relationship_type as TopologyRelationshipType)} → ${peerName}`}
                  >
                    {isRemoving ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                  </button>
                )}
                {edge.edge_source !== "manual" && (
                  <span className="ml-0.5 rounded-full bg-white/10 px-1 py-px text-[10px] opacity-60" title="Traffic-observed or metadata-declared edge">auto</span>
                )}
              </div>
            );
          })}

          {/* Pending (create-mode) edges */}
          {pending.map((p) => {
            const chipClass = TYPE_CHIP_CLASS[p.relationshipType] ?? "border-white/20 bg-white/5 text-muted";
            return (
              <div
                key={p.localId}
                role="listitem"
                className={[
                  "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  chipClass,
                  "ring-1 ring-brand/30"
                ].join(" ")}
                title="Queued — will be saved after device is created"
              >
                <span className="font-semibold">{relLabel(p.relationshipType)}</span>
                <span className="opacity-70">→</span>
                <span>{p.targetName}</span>
                <span className="ml-0.5 rounded-full bg-brand/20 px-1 py-px text-[10px] text-brand opacity-80">queued</span>
                <button
                  type="button"
                  onClick={() => handleRemovePending(p.localId)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full opacity-50 transition hover:bg-white/20 hover:opacity-100"
                  aria-label={`Remove queued ${p.relationshipType}`}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add relationship row */}
      {hasDevices && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">Add relationship</p>
          <div className="flex flex-wrap items-end gap-2">
            {/* Searchable device selector */}
            <div className="relative min-w-[160px] flex-1">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  id="rel-device-search"
                  placeholder="Search devices…"
                  value={search}
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 py-2 pl-8 pr-2.5 text-sm text-white outline-none transition placeholder:text-muted/60 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelDeviceId(""); // clear selection when typing again
                    setShowDropdown(true);
                  }}
                  onKeyDown={(e) => { if (e.key === "Escape") setShowDropdown(false); }}
                />
              </div>
              {showDropdown && filteredDevices.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/15 bg-[#0c152d] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                  role="listbox"
                  aria-label="Device suggestions"
                >
                  {filteredDevices.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={selDeviceId === String(d.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition hover:bg-brand/10 focus:outline-none"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectDevice(d); }}
                    >
                      <span className="flex-1 truncate font-medium">{d.name}</span>
                      {d.ip_address && (
                        <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[10px] text-muted">{d.ip_address}</span>
                      )}
                      {d.device_type && (
                        <span className="shrink-0 text-[11px] text-muted opacity-70">{d.device_type}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && search.trim() && filteredDevices.length === 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/10 bg-[#0c152d] px-3 py-2.5 text-xs text-muted shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                >
                  No matching devices found.
                </div>
              )}
            </div>

            {/* Relationship type */}
            <div className="min-w-[148px]">
              <select
                id="rel-type"
                className={SELECT_ROW}
                value={selType}
                onChange={(e) => setSelType(e.target.value as TopologyRelationshipType)}
                aria-label="Relationship type"
              >
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Add button */}
            <button
              type="button"
              id="rel-add-btn"
              onClick={handleAdd}
              disabled={adding || !selDeviceId}
              className="flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/15 px-3 py-2 text-xs font-medium text-brand transition hover:border-brand/60 hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {isEditMode ? "Add" : "Queue"}
            </button>
          </div>

          {addError && (
            <p className="mt-1.5 text-[11px] text-danger">{addError}</p>
          )}
          {!isEditMode && (
            <p className="mt-1.5 text-[11px] text-muted">
              Relationships will be created after the device is registered.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
