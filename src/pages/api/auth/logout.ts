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

    const protocol =
        ((req.headers["x-forwarded-proto"] as string | undefined) ||
            ((req.socket as { encrypted?: boolean }).encrypted ? "https" : "http"))
            .split(",")[0]
            .trim();
    const host = req.headers.host;
    const expectedOrigin = host ? `${protocol}://${host}` : null;

    if (!requestOrigin || !expectedOrigin || requestOrigin !== expectedOrigin) {
        return res.status(403).json({ message: "Forbidden" });
    }

    req.session.destroy();
    return res.status(200).json({ message: "ok" });
}

export default withSessionRoute(logoutRoute);
