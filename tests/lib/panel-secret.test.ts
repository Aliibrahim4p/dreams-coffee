import { issuePanelToken, verifyPanelSecret } from "@/lib/panel-secret";

describe("issuePanelToken", () => {
  it("returns the raw PANEL_SECRET_KEY value", () => {
    expect(issuePanelToken()).toBe(process.env.PANEL_SECRET_KEY);
  });

  it("throws when PANEL_SECRET_KEY is not set", () => {
    const original = process.env.PANEL_SECRET_KEY;
    delete process.env.PANEL_SECRET_KEY;

    expect(() => issuePanelToken()).toThrow("PANEL_SECRET_KEY is not set");

    process.env.PANEL_SECRET_KEY = original;
  });
});

describe("verifyPanelSecret", () => {
  it("returns true for the correct secret", () => {
    expect(verifyPanelSecret(process.env.PANEL_SECRET_KEY as string)).toBe(true);
  });

  it("returns false for a wrong secret", () => {
    expect(verifyPanelSecret("definitely-wrong")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(verifyPanelSecret("")).toBe(false);
  });

  it("throws when PANEL_SECRET_KEY is not set", () => {
    const original = process.env.PANEL_SECRET_KEY;
    delete process.env.PANEL_SECRET_KEY;

    expect(() => verifyPanelSecret("anything")).toThrow("PANEL_SECRET_KEY is not set");

    process.env.PANEL_SECRET_KEY = original;
  });
});
