import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { withSessionRoute } from "./session";

export function withAuth(handler: NextApiHandler): NextApiHandler {
    return withSessionRoute(async (req: NextApiRequest, res: NextApiResponse) => {
        const user = req.session.user;

        if (!user?.isLoggedIn) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        return handler(req, res);
    });
}
