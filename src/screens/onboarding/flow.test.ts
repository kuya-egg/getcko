import { describe, expect, it } from "vitest";
import type { SetupStatus } from "../../bindings/SetupStatus";
import type { PermissionStatus } from "../../bindings/PermissionStatus";
import type { ModelFile } from "../../bindings/ModelFile";
import * as seed from "../../lib/mock/seed";
import {
  askState,
  checkAgainMode,
  componentProblem,
  componentRows,
  firstOpenStep,
  flowReducer,
  gatedPermissions,
  INITIAL_FLOW,
  missingFile,
  offFeatures,
  readiness,
  stepsFor,
  formatModelSize,
  modelDownloadRows,
  visibleComponentRows,
} from "./flow";

const status = (
  perms: Partial<Record<"accessibility" | "screenRecording" | "microphone", PermissionStatus>>,
  setup: "ready" | "missing" | "loading" = "ready",
): SetupStatus => ({
  permissions: (["accessibility", "screenRecording", "microphone"] as const).map((kind) => ({
    kind,
    status: perms[kind] ?? "granted",
  })),
  components: seed.components(setup),
});

describe("stepsFor", () => {
  it("one step per gated permission, then ready", () => {
    expect(stepsFor(status({}))).toEqual(["accessibility", "screenRecording", "microphone", "ready"]);
  });
  it("adds a download step for missing required models", () => {
    const steps = stepsFor(status({}, "missing"));
    expect(steps[steps.length - 2]).toBe("models");
  });
  it("skips permissions the OS doesn't gate (Windows)", () => {
    const s = status({ accessibility: "notRequired", screenRecording: "notRequired", microphone: "notRequired" });
    expect(stepsFor(s)).toEqual(["ready"]);
  });
  it("only ready before the first read", () => {
    expect(stepsFor(undefined)).toEqual(["ready"]);
  });
});

describe("firstOpenStep", () => {
  it("starts at the first permission that is off", () => {
    expect(firstOpenStep(status({ accessibility: "notAsked" }))).toBe("accessibility");
    expect(firstOpenStep(status({ screenRecording: "denied" }))).toBe("screenRecording");
  });
  it("goes to the download step when required models are missing", () => {
    expect(firstOpenStep(status({}, "missing"))).toBe("models");
  });
});

describe("askState", () => {
  it("granted and notRequired read as Turned on", () => {
    expect(askState("granted", false)).toBe("granted");
    expect(askState("notRequired", true)).toBe("granted");
  });
  it("denied, or asked this session, is waiting (macOS forgets a refusal)", () => {
    expect(askState("denied", false)).toBe("waiting");
    expect(askState("notAsked", true)).toBe("waiting");
  });
  it("never asked is idle", () => {
    expect(askState("notAsked", false)).toBe("idle");
    expect(askState(undefined, false)).toBe("idle");
  });
});

describe("readiness", () => {
  it("loading until the engine event, ready after", () => {
    expect(readiness(status({}, "loading"))).toBe("loading");
    expect(readiness(status({}, "ready"))).toBe("ready");
    expect(readiness(undefined)).toBe("loading");
  });
  it("missing required models win", () => {
    expect(readiness(status({}, "missing"))).toBe("missing");
  });
  it("an optional component missing is not 'missing'", () => {
    const s = status({});
    s.components = s.components.map((c) =>
      c.component === "speechToText" ? { ...c, ready: false, detail: "model file not found: x.gguf" } : c,
    );
    expect(readiness(s)).toBe("ready");
  });
});

describe("componentRows", () => {
  it("required first, missing rows carry the file and reason", () => {
    const rows = componentRows(status({}, "missing"));
    expect(rows.map((r) => r.component)).toEqual(["chat", "embeddings", "speechToText", "textToSpeech", "microphone"]);
    expect(rows[0]).toMatchObject({ required: true, state: "failed", problem: "missing", file: "gemma-4-E2B-it-Q4_0.gguf" });
    expect(rows[3]).toMatchObject({ required: false, state: "ready" });
  });
  it("loading rows are processing, never failed", () => {
    expect(componentRows(status({}, "loading")).every((r) => r.state === "processing")).toBe(true);
  });
  it("empty before the first read", () => {
    expect(componentRows(undefined)).toEqual([]);
  });
});

describe("missingFile / componentProblem", () => {
  it("pulls the model file out of the detail", () => {
    expect(missingFile("model file not found: bge-small-en-v1.5-q8_0.gguf")).toBe("bge-small-en-v1.5-q8_0.gguf");
    expect(missingFile("not built on this OS")).toBeUndefined();
    expect(missingFile(null)).toBeUndefined();
  });
  it("sorts details into plain reasons", () => {
    expect(componentProblem("model file not found: a.gguf")).toBe("missing");
    expect(componentProblem("not built on this OS")).toBe("notHere");
    expect(componentProblem("llama init failed")).toBe("unavailable");
    expect(componentProblem(null)).toBe("unavailable");
  });
});

describe("offFeatures", () => {
  it("Accessibility off turns Screen Help off (screenshots moot)", () => {
    expect(offFeatures(status({ accessibility: "denied", screenRecording: "denied" }))).toEqual(["screenHelp"]);
  });
  it("Screen Recording off only drops screenshots", () => {
    expect(offFeatures(status({ screenRecording: "notAsked" }))).toEqual(["screenshots"]);
  });
  it("Microphone refused drops hold to talk; not asked yet does not (macOS asks on first hold)", () => {
    expect(offFeatures(status({ microphone: "denied" }))).toEqual(["holdToTalk"]);
    expect(offFeatures(status({ microphone: "notAsked" }))).toEqual([]);
  });
  it("nothing off when all on or not required", () => {
    expect(offFeatures(status({}))).toEqual([]);
    expect(offFeatures(status({ accessibility: "notRequired", screenRecording: "notRequired" }))).toEqual([]);
  });
});

describe("flowReducer", () => {
  const steps = stepsFor(status({ accessibility: "notAsked" }));

  it("starts once", () => {
    const s = flowReducer(INITIAL_FLOW, { type: "start", step: "accessibility" });
    expect(s.step).toBe("accessibility");
    expect(flowReducer(s, { type: "start", step: "ready" }).step).toBe("accessibility");
  });
  it("next and back move one step and set the direction", () => {
    let s = flowReducer(INITIAL_FLOW, { type: "start", step: "accessibility" });
    s = flowReducer(s, { type: "next", steps });
    expect(s).toMatchObject({ step: "screenRecording", dir: 1 });
    s = flowReducer(s, { type: "back", steps });
    expect(s).toMatchObject({ step: "accessibility", dir: -1 });
  });
  it("stops at both ends", () => {
    const first = flowReducer(INITIAL_FLOW, { type: "start", step: "accessibility" });
    expect(flowReducer(first, { type: "back", steps })).toBe(first);
    const last = flowReducer(INITIAL_FLOW, { type: "start", step: "ready" });
    expect(flowReducer(last, { type: "next", steps })).toBe(last);
  });
  it("does nothing before start", () => {
    expect(flowReducer(INITIAL_FLOW, { type: "next", steps })).toBe(INITIAL_FLOW);
  });
  it("remembers each asked permission once", () => {
    let s = flowReducer(INITIAL_FLOW, { type: "asked", kind: "accessibility" });
    s = flowReducer(s, { type: "asked", kind: "accessibility" });
    expect(s.asked).toEqual(["accessibility"]);
  });
});

describe("Windows (real backend shape)", () => {
  // src-tauri/src/platform/mod.rs Unbuilt: microphone notAsked, the rest notRequired.
  const win = status({ accessibility: "notRequired", screenRecording: "notRequired", microphone: "notAsked" });
  it("has no microphone step: Windows can't ask, only refuse", () => {
    expect(stepsFor(win, "win")).toEqual(["ready"]);
    expect(firstOpenStep(win, "win")).toBe("ready");
    expect(gatedPermissions(win, "win")).toEqual([]);
    expect(offFeatures(win)).toEqual([]);
  });
  it("shows the microphone once Windows refused it", () => {
    const refused = status({ accessibility: "notRequired", screenRecording: "notRequired", microphone: "denied" });
    expect(stepsFor(refused, "win")).toEqual(["microphone", "ready"]);
  });
  it("never shows the macOS-only permissions on a PC, whatever the backend reports", () => {
    const odd = status({ accessibility: "denied", screenRecording: "notAsked", microphone: "denied" });
    expect(stepsFor(odd, "win")).toEqual(["microphone", "ready"]);
    expect(stepsFor(odd, "mac")).toEqual(["accessibility", "screenRecording", "microphone", "ready"]);
  });
  it("macOS still asks for a notAsked microphone", () => {
    expect(stepsFor(status({ microphone: "notAsked" }), "mac")).toContain("microphone");
  });
});

describe("checkAgainMode", () => {
  it("reads again instead of bringing the macOS dialog back", () => {
    expect(checkAgainMode("notAsked")).toBe("refresh");
    expect(checkAgainMode("denied")).toBe("request");
  });
});

describe("visibleComponentRows", () => {
  it("lists models only while loading (the microphone device doesn't load)", () => {
    expect(visibleComponentRows(status({}, "loading")).map((r) => r.component)).toEqual([
      "chat",
      "embeddings",
      "speechToText",
      "textToSpeech",
    ]);
  });
  it("shows the microphone device only when it failed", () => {
    const s: SetupStatus = {
      ...status({}),
      components: [
        ...seed.readyComponents().filter((c) => c.component !== "microphone"),
        { component: "microphone", ready: false, detail: "no input device" },
      ],
    };
    expect(visibleComponentRows(s).map((r) => r.component)).toContain("microphone");
  });
});
describe("model download helpers", () => {
  it("formats decimal gigabytes with one decimal place", () => {
    expect(formatModelSize(5_200_000_000)).toBe("5.2 GB");
  });
  it("shows sizes under a gigabyte in megabytes, never 0.0 GB", () => {
    expect(formatModelSize(36_806_944)).toBe("37 MB");
    expect(formatModelSize(999_600_000)).toBe("1.0 GB");
    expect(formatModelSize(1_000_000_000)).toBe("1.0 GB");
  });
  it("groups projector files into human rows", () => {
    const files: ModelFile[] = [
      { file: "chat.gguf", role: "chat", required: true, bytes: 1_000_000_000, present: false },
      { file: "vision.gguf", role: "chatProjector", required: true, bytes: 500_000_000, present: false },
      { file: "ground.gguf", role: "grounder", required: false, bytes: 700_000_000, present: false },
      { file: "ground-projector.gguf", role: "grounderProjector", required: false, bytes: 300_000_000, present: false },
    ];
    expect(modelDownloadRows(files)).toEqual([
      { key: "Answer model", name: "Answer model", files: [files[0]], required: true, bytes: 1_000_000_000 },
      { key: "Screenshot reading", name: "Screenshot reading", files: [files[1]], required: true, bytes: 500_000_000 },
      { key: "Pointing on hard screens", name: "Pointing on hard screens", files: [files[2], files[3]], required: false, bytes: 1_000_000_000 },
    ]);
  });
});
