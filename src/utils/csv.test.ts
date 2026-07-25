import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildCSV, downloadCSV, type CsvColumn } from "./csv";

const columns: CsvColumn[] = [
  { key: "name", label: "Name", enabled: true },
  { key: "route", label: "Route", enabled: true },
  { key: "secret", label: "Secret", enabled: false },
];

describe("buildCSV", () => {
  it("emits only enabled columns in the header and body", () => {
    const csv = buildCSV([{ name: "Alice", route: "R1", secret: "hidden" }], columns);
    expect(csv).toBe("Name,Route\nAlice,R1");
    expect(csv).not.toContain("Secret");
    expect(csv).not.toContain("hidden");
  });

  it("renders null and undefined cells as empty strings", () => {
    const csv = buildCSV([{ name: null, route: undefined }], columns);
    expect(csv).toBe("Name,Route\n,");
  });

  it("quotes and escapes cells containing commas, quotes, or newlines", () => {
    const csv = buildCSV(
      [{ name: 'Ada, "Lovelace"', route: "line1\nline2" }],
      columns,
    );
    // internal quotes doubled, whole cell wrapped in quotes
    expect(csv).toContain('"Ada, ""Lovelace"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it("handles multiple rows and coerces numbers", () => {
    const csv = buildCSV(
      [
        { name: "A", route: 1 },
        { name: "B", route: 2 },
      ],
      columns,
    );
    expect(csv).toBe("Name,Route\nA,1\nB,2");
  });

  it("returns just a trailing newline when there are no rows", () => {
    const csv = buildCSV([], columns);
    expect(csv).toBe("Name,Route\n");
  });
});

describe("downloadCSV", () => {
  beforeEach(() => {
    // jsdom does not implement the object-URL API
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wires up an anchor, triggers a click, and cleans up", () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    downloadCSV("Name\nAlice", "report.csv");

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
