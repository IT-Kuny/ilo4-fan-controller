import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("../../lib/iloClient", () => ({
    unlockFans: jest.fn(),
}));

jest.mock("../../lib/withAuth", () => ({
    withAuth: (handler: any) => handler,
}));

import { unlockFans } from "../../lib/iloClient";
import handler from "../../pages/api/unlock";

const mockUnlockFans = unlockFans as jest.MockedFunction<typeof unlockFans>;

describe("POST /api/unlock", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns 200 on successful unlock", async () => {
        mockUnlockFans.mockResolvedValueOnce();

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toEqual({ message: "ok" });
        expect(mockUnlockFans).toHaveBeenCalledTimes(1);
    });

    it("returns 405 for GET requests", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
        expect(res._getHeaders().allow).toEqual(["POST"]);
    });

    it("returns 405 for PUT requests", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "PUT" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
    });

    it("returns 405 for DELETE requests", async () => {
        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(405);
    });

    it("returns 400 on unlock failure with Error", async () => {
        mockUnlockFans.mockRejectedValueOnce(new Error("SSH timeout"));

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: "SSH timeout" });
    });

    it("returns generic error for non-Error throws", async () => {
        mockUnlockFans.mockRejectedValueOnce("unknown");

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
        expect(JSON.parse(res._getData())).toEqual({ message: "Unable to unlock fans" });
    });
});
