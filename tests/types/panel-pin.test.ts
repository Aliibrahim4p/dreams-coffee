import { PanelPinVerifySchema } from "@/types/panel-pin";

describe("PanelPinVerifySchema", () => {
  it("accepts a non-empty pin", () => {
    expect(PanelPinVerifySchema.safeParse({ pin: "1234" }).success).toBe(true);
  });

  it("rejects an empty pin", () => {
    expect(PanelPinVerifySchema.safeParse({ pin: "" }).success).toBe(false);
  });

  it("rejects a missing pin", () => {
    expect(PanelPinVerifySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-digit pin", () => {
    expect(PanelPinVerifySchema.safeParse({ pin: "12a4" }).success).toBe(false);
  });

  it("rejects a pin containing injection metacharacters", () => {
    expect(PanelPinVerifySchema.safeParse({ pin: "1234'; --" }).success).toBe(false);
  });
});
