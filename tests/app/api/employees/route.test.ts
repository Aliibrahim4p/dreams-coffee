jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/employee-service");

import { NextRequest } from "next/server";
import { EmployeeService } from "@/services/employee-service";
import UniqueException from "@/exceptions/unique-exception";
import { GET, POST } from "@/app/api/employees/route";

const MockedEmployeeService = EmployeeService as jest.Mocked<typeof EmployeeService>;

const validBody = { pos_id: 101, first_name: "Jane", last_name: "Doe" };

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/employees", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/employees", () => {
  it("returns 201 with the created employee", async () => {
    MockedEmployeeService.createEmployee.mockResolvedValue({ ...validBody, is_active: true });

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(201);
  });

  it("returns 400 when a required field is missing", async () => {
    const res = await POST(makePostRequest({ first_name: "Jane" }));
    expect(res.status).toBe(400);
    expect(MockedEmployeeService.createEmployee).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/employees", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedEmployeeService.createEmployee).not.toHaveBeenCalled();
  });

  it("returns 409 when pos_id is already taken", async () => {
    MockedEmployeeService.createEmployee.mockRejectedValue(new UniqueException("pos_id already taken"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(409);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedEmployeeService.createEmployee.mockRejectedValue(new Error("db down"));

    const res = await POST(makePostRequest(validBody));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/employees", () => {
  it("defaults include_inactive to false", async () => {
    MockedEmployeeService.listEmployees.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/employees"));

    expect(MockedEmployeeService.listEmployees).toHaveBeenCalledWith(false);
  });

  it("passes include_inactive=true through from the query string", async () => {
    MockedEmployeeService.listEmployees.mockResolvedValue([]);

    await GET(new NextRequest("http://localhost/api/employees?include_inactive=true"));

    expect(MockedEmployeeService.listEmployees).toHaveBeenCalledWith(true);
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedEmployeeService.listEmployees.mockRejectedValue(new Error("db down"));

    const res = await GET(new NextRequest("http://localhost/api/employees"));

    expect(res.status).toBe(500);
  });
});
