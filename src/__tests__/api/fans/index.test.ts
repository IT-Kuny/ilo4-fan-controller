import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("../../../lib/iloClient", () => ({
    fetchFans: jest.fn(),
    setFanSpeeds: jest.fn(),
}));

jest.mock("../../../lib/withAuth", () => ({
    withAuth: (handler: any) => handler,
}));

import { fetchFans, setFanSpeeds } from "../../../lib/iloClient";
import handler from "../../../pages/api/fans/index";

const mockFetchFans = fetchFans as jest.MockedFunction<typeof fetchFans>;
const mockSetFanSpeeds = setFanSpeeds as jest.MockedFunction<typeof setFanSpeeds>;

describe("/api/fans", () => {
    beforeEach(() => jest.clearAllMocks());

    describe("GET", () => {
        it("returns 200 with fan data", async () => {
            const mockFans = [
                {
                    FanName: "Fan 1",
                    CurrentReading: 15,
                    Units: "Percent",
                    Status: { Health: "OK", State: "Enabled" },
                    Oem: { Hp: { "@odata.type": "", Location: "System", Type: "Fan" } },
                },
            ];
            mockFetchFans.mockResolvedValueOnce(mockFans);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            expect(JSON.parse(res._getData())).toEqual({ fans: mockFans });
        });

        it("returns 500 on fetch error", async () => {
            mockFetchFans.mockRejectedValueOnce(new Error("Network error"));

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            expect(JSON.parse(res._getData())).toEqual({ message: "Network error" });
        });

        it("returns generic message for non-Error GET failures", async () => {
            mockFetchFans.mockRejectedValueOnce(42);

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            expect(JSON.parse(res._getData())).toEqual({ message: "Unknown error" });
        });
    });

    describe("POST", () => {
        it("returns 200 on valid fan speed payload", async () => {
            mockSetFanSpeeds.mockResolvedValueOnce();

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [50, 60, 70] },
            });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            expect(JSON.parse(res._getData())).toEqual({ message: "ok" });
        });

        it("returns 400 on validation error (below min)", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [5] },
            });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });

        it("returns 400 on setFanSpeeds failure", async () => {
            mockSetFanSpeeds.mockRejectedValueOnce(new Error("SSH error"));

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [50] },
            });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });

        it("returns generic message for non-Error POST failures", async () => {
            mockSetFanSpeeds.mockRejectedValueOnce("oops");

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [50] },
            });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            expect(JSON.parse(res._getData())).toEqual({ message: "Invalid request" });
        });
    });

    describe("Method enforcement", () => {
        it.each(["DELETE", "PUT", "PATCH"] as const)("returns 405 for %s", async (method) => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method });
            await handler(req, res);

            expect(res._getStatusCode()).toBe(405);
            expect(res._getHeaders().allow).toEqual(["GET", "POST"]);
            expect(JSON.parse(res._getData())).toEqual({ message: "Method Not Allowed" });
        });
    });
});
