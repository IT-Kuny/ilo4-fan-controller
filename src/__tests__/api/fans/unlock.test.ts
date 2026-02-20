import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("../../../lib/iloClient", () => ({
    unlockFans: jest.fn(),
}));

import { unlockFans } from "../../../lib/iloClient";
import handler from "../../../pages/api/fans/unlock";

const mockUnlockFans = unlockFans as jest.MockedFunction<typeof unlockFans>;

describe("POST /api/fans/unlock", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns 200 on successful unlock", async () => {
        mockUnlockFans.mockResolvedValueOnce();

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual({ message: "ok" });
    });

    it("returns 405 for GET", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders().allow).toEqual(["POST"]);
    });

    it("returns 405 for DELETE", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
    });

    it("returns 400 on unlock error", async () => {
        mockUnlockFans.mockRejectedValueOnce(new Error("Connection failed"));

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: "Connection failed" });
    });

    it("returns generic error for non-Error throws", async () => {
        mockUnlockFans.mockRejectedValueOnce(42);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: "Unable to unlock fans" });
    });
});
