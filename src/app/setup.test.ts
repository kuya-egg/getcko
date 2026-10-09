import { describe, expect, it } from "vitest";
import type { ComponentStatus } from "../bindings/ComponentStatus";
import type { SetupStatus } from "../bindings/SetupStatus";
import { LOADING_MODELS_DETAIL, withEngineComponents } from "./setup";

const loading: ComponentStatus = { component: "chat", ready: false, detail: LOADING_MODELS_DETAIL };
const ready: ComponentStatus = { component: "chat", ready: true, detail: null };
const status = (c: ComponentStatus): SetupStatus => ({ permissions: [], components: [c] });

describe("withEngineComponents", () => {
  it("keeps a read when the engine event has not fired", () => {
    expect(withEngineComponents(status(loading), null).components).toEqual([loading]);
  });
  it("replaces a stale loading read with the engine event's list", () => {
    expect(withEngineComponents(status(loading), [ready]).components).toEqual([ready]);
  });
  it("keeps a settled read over the event", () => {
    const missing: ComponentStatus = { component: "chat", ready: false, detail: "model file missing" };
    expect(withEngineComponents(status(missing), [ready]).components).toEqual([missing]);
  });
});
