import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "../../../lib/session";

async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const originHeader = (req.headers.origin as string | undefined) || undefined;
    const refererHeader = (req.headers.referer as string | undefined) || undefined;

    let requestOrigin: string | null = null;
    if (originHeader) {
        requestOrigin = originHeader;
    } else if (refererHeader) {
        try {
            const url = new URL(refererHeader);
            requestOrigin = url.origin;
        } catch {
            requestOrigin = null;
        }
    }

    // Build the expected origin from proxy headers, falling back to the
    // direct connection. Handles comma-separated x-forwarded-* values that
    // appear when multiple reverse proxies are chained.
    const forwardedProtoHeader = req.headers["x-forwarded-proto"];
    let protocol: string;
    if (typeof forwardedProtoHeader === "string" && forwardedProtoHeader.length > 0) {
        protocol = forwardedProtoHeader.split(",")[0].trim();
    } else {
        const socket = req.socket as unknown;
        const isEncrypted =
            !!socket &&
            typeof socket === "object" &&
            "encrypted" in (socket as Record<string, unknown>) &&
            (socket as Record<string, unknown>).encrypted === true;
        protocol = isEncrypted ? "https" : "http";
    }

    const forwardedHost = req.headers["x-forwarded-host"];
    const host =
        (typeof forwardedHost === "string" && forwardedHost.length > 0
            ? forwardedHost.split(",")[0].trim()
            : undefined) || req.headers.host;
    const expectedOrigin = host ? `${protocol}://${host}` : null;

    if (!requestOrigin || !expectedOrigin || requestOrigin !== expectedOrigin) {
        return res.status(403).json({ message: "Forbidden" });
    }

    req.session.destroy();
    return res.status(200).json({ message: "ok" });
}

export default withSessionRoute(logoutRoute);
