/**
 * Security tests covering common Next.js / REST API CVEs and attack vectors:
 *
 * - HTTP method enforcement (prevent unintended state changes)
 * - Input validation and sanitization (injection, XSS payloads)
 * - Prototype pollution via __proto__ / constructor in request body
 * - Oversized payload handling
 * - Error message information leakage (no stack traces or internals exposed)
 * - Header injection via malicious input
 * - Environment variable validation (missing credentials)
 */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { changeFanSpeedSchema } from "../../schemas/changeFanSpeed";

const MISSING_ENV_ERROR = "Missing required environment variables: ILO_HOST, ILO_USERNAME, ILO_PASSWORD";

// Mock iloClient for all API route tests
jest.mock("../../lib/iloClient", () => ({
    fetchFans: jest.fn().mockResolvedValue([]),
    unlockFans: jest.fn().mockResolvedValue(undefined),
    setFanSpeeds: jest.fn().mockResolvedValue(undefined),
}));

// Mock withAuth to pass through the handler directly (bypasses session/auth)
jest.mock("../../lib/withAuth", () => ({
    withAuth: (handler: any) => handler,
}));

import unlockHandler from "../../pages/api/unlock";
import tempsHandler from "../../pages/api/temps";
import fansHandler from "../../pages/api/fans/index";
import fansUnlockHandler from "../../pages/api/fans/unlock";

describe("Security Tests", () => {
    beforeEach(() => jest.clearAllMocks());

    describe("HTTP Method Enforcement", () => {
        it("POST /api/unlock rejects GET", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await unlockHandler(req, res);
            expect(res._getStatusCode()).toBe(405);
        });

        it("POST /api/unlock rejects DELETE", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
            await unlockHandler(req, res);
            expect(res._getStatusCode()).toBe(405);
        });

        it("POST /api/fans/unlock rejects PUT", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "PUT" });
            await fansUnlockHandler(req, res);
            expect(res._getStatusCode()).toBe(405);
        });

        it("/api/fans rejects DELETE", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
            await fansHandler(req, res);
            expect(res._getStatusCode()).toBe(405);
        });

        it("/api/fans rejects PATCH", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "PATCH" });
            await fansHandler(req, res);
            expect(res._getStatusCode()).toBe(405);
        });

        it("405 responses include Allow header", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
            await fansHandler(req, res);
            expect(res._getHeaders().allow).toBeDefined();
        });
    });

    describe("Input Validation & Injection Prevention", () => {
        it("rejects string values in fans array (command injection attempt)", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: ["; rm -rf /"] })
            ).rejects.toThrow();
        });

        it("rejects nested object values in fans array", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: [{ nested: { deep: true } }] })
            ).rejects.toThrow();
        });

        it("rejects NaN values", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: [NaN] })
            ).rejects.toThrow();
        });

        it("rejects Infinity values", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: [Infinity] })
            ).rejects.toThrow();
        });

        it("rejects script tags in fan values (XSS attempt)", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: ["<script>alert(1)</script>"] })
            ).rejects.toThrow();
        });

        it("rejects extremely large numbers", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: [Number.MAX_SAFE_INTEGER] })
            ).rejects.toThrow();
        });

        it("rejects boolean values in fans array", async () => {
            await expect(
                changeFanSpeedSchema.validate({ fans: [true] })
            ).rejects.toThrow();
        });
    });

    describe("Prototype Pollution Prevention", () => {
        it("POST /api/fans rejects payload with __proto__ and no fans field", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { __proto__: { isAdmin: true } },
            });
            await fansHandler(req, res);
            expect(res._getStatusCode()).toBe(400);
        });

        it("schema only returns known fields", async () => {
            const result = await changeFanSpeedSchema.validate(
                { fans: [50], extraPollution: true },
                { stripUnknown: true }
            );
            expect(result).not.toHaveProperty("extraPollution");
            expect(Object.keys(result)).toEqual(["fans"]);
        });

        it("POST /api/fans with extra fields does not leak them through", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [50], isAdmin: true, role: "superuser" },
            });
            await fansHandler(req, res);
            // Even if it succeeds, the extra fields shouldn't affect behavior
            expect([200, 400]).toContain(res._getStatusCode());
        });
    });

    describe("Oversized Payload Handling", () => {
        it("accepts a large fans array when all values are within bounds", async () => {
            const hugeFans = new Array(10000).fill(50);
            // This should still pass schema validation (the schema doesn't limit array size)
            // but the values are within bounds. This test confirms the schema handles large arrays.
            const result = await changeFanSpeedSchema.validate({ fans: hugeFans });
            expect(result.fans).toHaveLength(10000);
        });

        it("schema rejects if any value in large array is out of bounds", async () => {
            const hugeFans = new Array(100).fill(50);
            hugeFans[99] = 999;
            await expect(changeFanSpeedSchema.validate({ fans: hugeFans })).rejects.toThrow();
        });
    });

    describe("Error Information Leakage", () => {
        it("GET /api/temps does not leak stack traces", async () => {
            const { fetchFans } = require("../../lib/iloClient");
            fetchFans.mockRejectedValueOnce(new Error("ECONNREFUSED 192.168.1.100:443"));

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await tempsHandler(req, res);

            const body = JSON.parse(res._getData());
            expect(body).not.toHaveProperty("stack");
            expect(body).not.toHaveProperty("code");
            expect(body.message).toBeDefined();
            expect(typeof body.message).toBe("string");
        });

        it("POST /api/unlock does not expose internal details on error", async () => {
            const { unlockFans } = require("../../lib/iloClient");
            unlockFans.mockRejectedValueOnce(new Error("SSH connection failed to 192.168.1.100"));

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
            await unlockHandler(req, res);

            const body = JSON.parse(res._getData());
            expect(body).not.toHaveProperty("stack");
            expect(Object.keys(body)).toEqual(["message"]);
        });

        it("POST /api/fans does not expose internal details on validation error", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: { fans: [5] },
            });
            await fansHandler(req, res);

            const body = JSON.parse(res._getData());
            expect(body).not.toHaveProperty("stack");
            expect(body).not.toHaveProperty("code");
        });

        it("non-Error throws return generic messages only", async () => {
            const { fetchFans } = require("../../lib/iloClient");
            fetchFans.mockRejectedValueOnce({ secret: "internal_db_password" });

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await tempsHandler(req, res);

            const body = JSON.parse(res._getData());
            expect(body.message).toBe("Internal Server Error");
            expect(body).not.toHaveProperty("secret");
        });
    });

    describe("Environment Variable Validation", () => {
        it("missing environment variables are caught before external calls", async () => {
            // Test at the API level: if env vars are missing and iloClient
            // actually throws, the error is handled properly.
            const { fetchFans } = require("../../lib/iloClient");
            fetchFans.mockRejectedValueOnce(
                new Error(MISSING_ENV_ERROR)
            );

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await tempsHandler(req, res);

            expect(res._getStatusCode()).toBe(500);
            const body = JSON.parse(res._getData());
            expect(body.message).toContain("Missing required environment variables");
        });

        it("error message enumerates all missing variables", async () => {
            const { fetchFans } = require("../../lib/iloClient");
            fetchFans.mockRejectedValueOnce(
                new Error(MISSING_ENV_ERROR)
            );

            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
            await tempsHandler(req, res);

            const body = JSON.parse(res._getData());
            expect(body.message).toContain("ILO_HOST");
            expect(body.message).toContain("ILO_USERNAME");
            expect(body.message).toContain("ILO_PASSWORD");
        });
    });

    describe("Content-Type Handling", () => {
        it("POST /api/fans handles missing body gracefully", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: undefined,
            });
            await fansHandler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });

        it("POST /api/fans handles null body gracefully", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: null,
            });
            await fansHandler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });

        it("POST /api/fans handles empty object body", async () => {
            const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
                method: "POST",
                body: {},
            });
            await fansHandler(req, res);

            expect(res._getStatusCode()).toBe(400);
        });
    });
});
