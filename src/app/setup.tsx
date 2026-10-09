// Setup status shared by the shell (first-run gate), onboarding and Settings.
// One setupStatus() read at start, refreshed on the 'engine' event (no polling) and on demand.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ComponentStatus } from "../bindings/ComponentStatus";
import type { EngineComponent } from "../bindings/EngineComponent";
import type { PermissionKind } from "../bindings/PermissionKind";
import type { PermissionStatus } from "../bindings/PermissionStatus";
import type { SetupStatus } from "../bindings/SetupStatus";
import { onEngine, permissionRequest, setupStatus } from "../lib/getcko";
import { useResource } from "./useResource";

/** Components GetcKo can't answer without. The rest (voice in and out, mic) are optional. */
export const REQUIRED_COMPONENTS: readonly EngineComponent[] = ["chat", "embeddings"];

/** setup_status reports this detail for every component until the 'engine' event fires. */
export const LOADING_MODELS_DETAIL = "loading models";

export const isLoadingModels = (c: ComponentStatus): boolean => !c.ready && c.detail === LOADING_MODELS_DETAIL;

/** Granted, or not needed on this OS. */
export const isAllowed = (s: PermissionStatus | undefined): boolean => s === "granted" || s === "notRequired";

export function permissionOf(status: SetupStatus | undefined, kind: PermissionKind): PermissionStatus | undefined {
  return status?.permissions.find((p) => p.kind === kind)?.status;
}

export function componentOf(status: SetupStatus | undefined, component: EngineComponent): ComponentStatus | undefined {
  return status?.components.find((c) => c.component === component);
}

/** Still waiting for the engine to finish loading (not missing, just not yet). */
export function modelsLoading(status: SetupStatus | undefined): boolean {
  return !!status?.components.some(isLoadingModels);
}

/** Required components that are missing for real (not merely still loading). */
export function missingComponents(status: SetupStatus | undefined): ComponentStatus[] {
  if (!status) return [];
  return status.components.filter((c) => REQUIRED_COMPONENTS.includes(c.component) && !c.ready && !isLoadingModels(c));
}

/**
 * The first-run gate: onboarding takes the whole window when Accessibility is not on, or a required
 * model is missing. Screen Recording and Microphone are optional (they only turn features off).
 */
export function needsSetup(status: SetupStatus | undefined): boolean {
  if (!status) return false;
  return !isAllowed(permissionOf(status, "accessibility")) || missingComponents(status).length > 0;
}

/**
 * A setup_status read that started before the 'engine' event can settle after it and still say
 * "loading models". Once the event has given the final list, keep it over any stale loading read.
 */
export function withEngineComponents(status: SetupStatus, engine: ComponentStatus[] | null): SetupStatus {
  if (!engine || !status.components.some(isLoadingModels)) return status;
  return { ...status, components: engine };
}

export interface SetupValue {
  /** undefined until the first read settles. */
  status: SetupStatus | undefined;
  error: unknown;
  loading: boolean;
  /** Read setup_status again ("Check again"). */
  refresh: () => Promise<void>;
  /** Ask the OS for a permission, then refresh. Returns the new state. */
  request: (kind: PermissionKind) => Promise<PermissionStatus>;
}

const SetupContext = createContext<SetupValue | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  // Models finish loading once per launch: the event's component list is final.
  const engine = useRef<ComponentStatus[] | null>(null);
  const load = useCallback(async () => withEngineComponents(await setupStatus(), engine.current), []);
  const res = useResource(load, []);
  const { setData, reload } = res;

  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void onEngine((components) => {
      engine.current = components;
      setData((prev) => ({ permissions: prev?.permissions ?? [], components }));
    }).then((u) => {
      if (dead) u();
      else off = u;
    });
    return () => {
      dead = true;
      off?.();
    };
  }, [setData]);

  const request = useCallback(
    async (kind: PermissionKind) => {
      const next = await permissionRequest(kind);
      setData((prev) => ({
        components: prev?.components ?? [],
        permissions: (prev?.permissions ?? []).map((p) => (p.kind === kind ? { kind, status: next } : p)),
      }));
      return next;
    },
    [setData],
  );

  const value = useMemo<SetupValue>(
    () => ({ status: res.data, error: res.error, loading: res.loading, refresh: reload, request }),
    [res.data, res.error, res.loading, reload, request],
  );
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

/** Setup status from the shell. Use inside the main window only. */
export function useSetup(): SetupValue {
  const v = useContext(SetupContext);
  if (!v) throw new Error("useSetup must be used inside <SetupProvider>");
  return v;
}
