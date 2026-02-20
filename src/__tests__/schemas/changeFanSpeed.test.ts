import { changeFanSpeedSchema } from "../../schemas/changeFanSpeed";

describe("changeFanSpeedSchema", () => {
    it("validates a correct payload with multiple fans", async () => {
        const result = await changeFanSpeedSchema.validate({ fans: [50, 60, 70, 80] });
        expect(result.fans).toEqual([50, 60, 70, 80]);
    });

    it("accepts the minimum fan speed of 10", async () => {
        const result = await changeFanSpeedSchema.validate({ fans: [10] });
        expect(result.fans).toEqual([10]);
    });

    it("accepts the maximum fan speed of 100", async () => {
        const result = await changeFanSpeedSchema.validate({ fans: [100] });
        expect(result.fans).toEqual([100]);
    });

    it("accepts an empty fans array", async () => {
        const result = await changeFanSpeedSchema.validate({ fans: [] });
        expect(result.fans).toEqual([]);
    });

    it("rejects fan speed below minimum (< 10)", async () => {
        await expect(changeFanSpeedSchema.validate({ fans: [5] })).rejects.toThrow();
    });

    it("rejects fan speed above maximum (> 100)", async () => {
        await expect(changeFanSpeedSchema.validate({ fans: [150] })).rejects.toThrow();
    });

    it("rejects negative fan speed", async () => {
        await expect(changeFanSpeedSchema.validate({ fans: [-1] })).rejects.toThrow();
    });

    it("rejects missing fans field", async () => {
        await expect(changeFanSpeedSchema.validate({})).rejects.toThrow();
    });

    it("rejects null fans", async () => {
        await expect(changeFanSpeedSchema.validate({ fans: null })).rejects.toThrow();
    });

    it("rejects non-numeric array entries", async () => {
        await expect(changeFanSpeedSchema.validate({ fans: ["abc"] })).rejects.toThrow();
    });

    it("strips unknown fields with stripUnknown option", async () => {
        const result = await changeFanSpeedSchema.validate(
            { fans: [50], extra: "malicious" },
            { stripUnknown: true }
        );
        expect(result).not.toHaveProperty("extra");
        expect(result.fans).toEqual([50]);
    });

    it("collects all validation errors with abortEarly: false", async () => {
        try {
            await changeFanSpeedSchema.validate({ fans: [5, 200, -1] }, { abortEarly: false });
            throw new Error("Expected validation to fail");
        } catch (err: unknown) {
            const yupErr = err as { inner: unknown[] };
            expect(yupErr.inner.length).toBeGreaterThanOrEqual(2);
        }
    });
});
