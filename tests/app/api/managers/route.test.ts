jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/manager-service");

import { NextRequest } from "next/server";
import { ManagerService } from "@/services/manager-service";
import UniqueException from "@/exceptions/unique-exception";
import { GET, POST } from "@/app/api/managers/route";

const MockedManagerService = ManagerService as jest.Mocked<typeof ManagerService>;

const validBody = { username: "jdoe", password: "Hunter2!", first_name: "Jane", last_name: "Doe" };

// Admin auth for this route is enforced entirely by proxy.ts (X-Admin-Token, see
// tests/proxy.test.ts) — the handler itself no longer checks any admin credential.
function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/managers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/managers", () => {
  it("returns 201 with the created manager", async () => {
    MockedManagerService.createManager.mockResolvedValue({
      manager_id: 1,
      username: "jdoe",
      first_name: "Jane",
      last_name: "Doe",
      is_active: true,
      created_at: new Date(),
    });

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
  });

  it("returns 400 when a required field is missing", async () => {
    const res = await POST(makePostRequest({ username: "jdoe" }));
    expect(res.status).toBe(400);
    expect(MockedManagerService.createManager).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/managers", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedManagerService.createManager).not.toHaveBeenCalled();
  });

  it("returns 400 when the password fails the complexity policy", async () => {
    const res = await POST(makePostRequest({ ...validBody, password: "weak" }));
    expect(res.status).toBe(400);
    expect(MockedManagerService.createManager).not.toHaveBeenCalled();
  });

  it("returns 409 when the username is already taken", async () => {
    MockedManagerService.createManager.mockRejectedValue(new UniqueException("Username already taken"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(409);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedManagerService.createManager.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/managers", () => {
  it("defaults include_inactive to false", async () => {
    MockedManagerService.listManagers.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/managers"));

    expect(MockedManagerService.listManagers).toHaveBeenCalledWith(false);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedManagerService.listManagers.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/managers"));

    expect(res.status).toBe(500);
  });
});
