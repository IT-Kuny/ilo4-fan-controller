jest.mock("node-ssh");
jest.mock("undici", () => ({
    Agent: jest.fn().mockImplementation(() => ({})),
}));

import { NodeSSH } from "node-ssh";

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const ENV = {
    ILO_HOST: "192.168.1.100",
    ILO_USERNAME: "admin",
    ILO_PASSWORD: "password123",
};

beforeEach(() => {
    process.env.ILO_HOST = ENV.ILO_HOST;
    process.env.ILO_USERNAME = ENV.ILO_USERNAME;
    process.env.ILO_PASSWORD = ENV.ILO_PASSWORD;
    jest.clearAllMocks();
});

afterEach(() => {
    delete process.env.ILO_HOST;
    delete process.env.ILO_USERNAME;
    delete process.env.ILO_PASSWORD;
});

// Require after mocks are set up to avoid module caching issues
const getClient = () => require("../../lib/iloClient");

describe("iloClient", () => {
    describe("fetchFans", () => {
        it("returns fan data on successful API call", async () => {
            const mockFanData = [
                {
                    FanName: "Fan 1",
                    CurrentReading: 15,
                    Units: "Percent",
                    Status: { Health: "OK", State: "Enabled" },
                    Oem: { Hp: { "@odata.type": "#HpServerFan.v2_0_0.HpServerFan", Location: "System", Type: "Fan" } },
                },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ Fans: mockFanData }),
            });

            const { fetchFans } = getClient();
            const fans = await fetchFans();

            expect(fans).toEqual(mockFanData);
            expect(mockFetch).toHaveBeenCalledWith(
                `https://${ENV.ILO_HOST}/redfish/v1/chassis/1/Thermal`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: expect.stringMatching(/^Basic /),
                    }),
                })
            );
        });

        it("throws on non-OK HTTP response", async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

            const { fetchFans } = getClient();
            await expect(fetchFans()).rejects.toThrow("Unable to fetch fan data (401)");
        });

        it("returns empty array when Fans key is absent", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            const { fetchFans } = getClient();
            const fans = await fetchFans();
            expect(fans).toEqual([]);
        });

        it("throws when ILO_HOST is missing", async () => {
            delete process.env.ILO_HOST;
            const { fetchFans } = getClient();
            await expect(fetchFans()).rejects.toThrow("Missing required environment variables");
        });

        it("throws when ILO_USERNAME is missing", async () => {
            delete process.env.ILO_USERNAME;
            const { fetchFans } = getClient();
            await expect(fetchFans()).rejects.toThrow("Missing required environment variables");
        });

        it("throws when ILO_PASSWORD is missing", async () => {
            delete process.env.ILO_PASSWORD;
            const { fetchFans } = getClient();
            await expect(fetchFans()).rejects.toThrow("Missing required environment variables");
        });
    });

    describe("unlockFans", () => {
        const setupSshMocks = (overrides: Record<string, jest.Mock> = {}) => {
            const mocks = {
                connect: jest.fn().mockResolvedValue(undefined),
                execCommand: jest.fn().mockResolvedValue({ stdout: "", stderr: "" }),
                dispose: jest.fn(),
                ...overrides,
            };
            (NodeSSH as unknown as jest.Mock).mockImplementation(() => mocks);
            return mocks;
        };

        it("executes unlock command via SSH", async () => {
            const mocks = setupSshMocks();

            const { unlockFans } = getClient();
            await unlockFans();

            expect(mocks.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: ENV.ILO_HOST,
                    username: ENV.ILO_USERNAME,
                    password: ENV.ILO_PASSWORD,
                })
            );
            expect(mocks.execCommand).toHaveBeenCalledWith("fan p global unlock");
            expect(mocks.dispose).toHaveBeenCalled();
        });

        it("disposes SSH connection even on error", async () => {
            const mocks = setupSshMocks({
                execCommand: jest.fn().mockRejectedValue(new Error("SSH failure")),
            });

            const { unlockFans } = getClient();
            await expect(unlockFans()).rejects.toThrow("SSH failure");
            expect(mocks.dispose).toHaveBeenCalled();
        });

        it("throws when environment variables are missing", async () => {
            delete process.env.ILO_HOST;
            const { unlockFans } = getClient();
            await expect(unlockFans()).rejects.toThrow("Missing required environment variables");
        });
    });

    describe("setFanSpeeds", () => {
        const setupSshMocks = (overrides: Record<string, jest.Mock> = {}) => {
            const mocks = {
                connect: jest.fn().mockResolvedValue(undefined),
                execCommand: jest.fn().mockResolvedValue({ stdout: "", stderr: "" }),
                dispose: jest.fn(),
                ...overrides,
            };
            (NodeSSH as unknown as jest.Mock).mockImplementation(() => mocks);
            return mocks;
        };

        it("converts percentages to 0-255 range and sends SSH commands", async () => {
            const mocks = setupSshMocks();

            const { setFanSpeeds } = getClient();
            await setFanSpeeds({ fans: [50, 100] });

            // 50% → Math.round((50/100)*255) = 128
            // 100% → Math.round((100/100)*255) = 255
            expect(mocks.execCommand).toHaveBeenCalledWith("fan p 0 lock 128");
            expect(mocks.execCommand).toHaveBeenCalledWith("fan p 1 lock 255");
            expect(mocks.dispose).toHaveBeenCalled();
        });

        it("validates input before sending SSH commands", async () => {
            const mocks = setupSshMocks();

            const { setFanSpeeds } = getClient();
            await expect(setFanSpeeds({ fans: [5] })).rejects.toThrow();
            expect(mocks.execCommand).not.toHaveBeenCalled();
        });

        it("strips https:// protocol prefix from host", async () => {
            process.env.ILO_HOST = "https://192.168.1.100";
            const mocks = setupSshMocks();

            const { setFanSpeeds } = getClient();
            await setFanSpeeds({ fans: [50] });

            expect(mocks.connect).toHaveBeenCalledWith(
                expect.objectContaining({ host: "192.168.1.100" })
            );
        });

        it("calculates correct speed for minimum value (10%)", async () => {
            const mocks = setupSshMocks();

            const { setFanSpeeds } = getClient();
            await setFanSpeeds({ fans: [10] });

            // 10% → Math.round((10/100)*255) = 26
            expect(mocks.execCommand).toHaveBeenCalledWith("fan p 0 lock 26");
        });
    });
});
