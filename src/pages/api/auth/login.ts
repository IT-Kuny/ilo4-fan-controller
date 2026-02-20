import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { withSessionRoute } from "../../../lib/session";

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        timingSafeEqual(bufA, bufA);
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const { username, password } = req.body;

    if (
        typeof username === "string" &&
        typeof password === "string" &&
        safeCompare(username, process.env.AUTH_USERNAME) &&
        safeCompare(password, process.env.AUTH_PASSWORD)
    ) {
        req.session.user = {
            username,
            isLoggedIn: true,
        };
        await req.session.save();
        return res.status(200).json({ message: "ok" });
    }

    return res.status(401).json({ message: "Invalid credentials" });
}

export default withSessionRoute(loginRoute);
