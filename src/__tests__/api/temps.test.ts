import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("../../lib/iloClient", () => ({
    fetchFans: jest.fn(),
}));

import { fetchFans } from "../../lib/iloClient";
import handler from "../../pages/api/temps";

const mockFetchFans = fetchFans as jest.MockedFunction<typeof fetchFans>;

describe("GET /api/temps", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns 200 with fan data on success", async () => {
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

    it("returns 500 with error message on failure", async () => {
        mockFetchFans.mockRejectedValueOnce(new Error("Connection refused"));

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({ message: "Connection refused" });
    });

    it("returns generic message for non-Error throws", async () => {
        mockFetchFans.mockRejectedValueOnce("something broke");

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(500);
        expect(JSON.parse(res._getData())).toEqual({ message: "Internal Server Error" });
    });
});
