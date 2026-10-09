import { describe, expect, it } from "vitest";
import { formatLatency, latencyBreakdown } from "./latency";

describe("formatLatency", () => {
  it("shows one decimal of seconds with the host label", () => {
    expect(formatLatency(900, "on this Mac")).toBe("0.9 s · on this Mac");
  });

  it("rounds half up at the tenth boundary", () => {
    expect(formatLatency(949, "on this PC")).toBe("0.9 s · on this PC");
    expect(formatLatency(950, "on this PC")).toBe("1.0 s · on this PC");
    expect(formatLatency(1250, "on this PC")).toBe("1.3 s · on this PC");
  });

  it("keeps the trailing zero for whole seconds", () => {
    expect(formatLatency(2000, "on this Mac")).toBe("2.0 s · on this Mac");
  });
});

describe("latencyBreakdown", () => {
  it("lists every measured stage in order", () => {
    expect(
      latencyBreakdown({ transcribeMs: 210, screenMs: 120, retrievalMs: 40, firstTokenMs: 610, totalMs: 900 }),
    ).toBe("speech-to-text 210 ms · screen 120 ms · search 40 ms · first word 610 ms · total 900 ms");
  });

  it("omits stages that were not measured", () => {
    expect(
      latencyBreakdown({ transcribeMs: null, screenMs: null, retrievalMs: 40, firstTokenMs: null, totalMs: 300 }),
    ).toBe("search 40 ms · total 300 ms");
  });

  it("shows zero retrieval as a measured value", () => {
    expect(
      latencyBreakdown({ transcribeMs: null, screenMs: 5, retrievalMs: 0, firstTokenMs: null, totalMs: 80 }),
    ).toBe("screen 5 ms · search 0 ms · total 80 ms");
  });
});
