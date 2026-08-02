jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/exchange-rate-service");

import { NextRequest } from "next/server";
import { ExchangeRateService } from "@/services/exchange-rate-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET, PUT } from "@/app/api/config/exchange-rate/route";

const MockedService = ExchangeRateService as jest.Mocked<typeof ExchangeRateService>;

describe("GET /api/config/exchange-rate", () => {
  it("returns 200 with the current rate", async () => {
    MockedService.getExchangeRate.mockResolvedValue({ rate_value: 89500 });

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ rate_value: 89500 });
  });

  it("returns 404 when no rate is configured", async () => {
    MockedService.getExchangeRate.mockRejectedValue(new NotFoundException("Exchange rate not configured"));

    const res = await GET();

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/config/exchange-rate", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/config/exchange-rate", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 200 with the updated rate", async () => {
    MockedService.updateExchangeRate.mockResolvedValue({ rate_value: 90000 });

    const res = await PUT(makeRequest({ rate_value: 90000 }));

    expect(res.status).toBe(200);
    expect(MockedService.updateExchangeRate).toHaveBeenCalledWith(90000);
  });

  it("returns 400 when rate_value is missing", async () => {
    const res = await PUT(makeRequest({}));
    expect(res.status).toBe(400);
    expect(MockedService.updateExchangeRate).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/config/exchange-rate", {
      method: "PUT",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    expect(MockedService.updateExchangeRate).not.toHaveBeenCalled();
  });

  it("returns 400 when rate_value is zero or negative", async () => {
    const res = await PUT(makeRequest({ rate_value: -5 }));
    expect(res.status).toBe(400);
  });
});
