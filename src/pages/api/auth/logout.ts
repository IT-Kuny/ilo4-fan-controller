import type { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from "../../../lib/session";

async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    req.session.destroy();
    return res.status(200).json({ message: "ok" });
}

export default withSessionRoute(logoutRoute);
