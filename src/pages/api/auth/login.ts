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

// NOTE: Rate limiting uses an in-memory store. Limits reset on server restart
// and are not shared across instances in load-balanced deployments. For
// multi-instance production environments, replace with a shared store (e.g. Redis).
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record || now > record.resetAt) {
        loginAttempts.delete(ip);
        return false;
    }

    return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record || now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
        record.count++;
    }

    // Clean up expired entries periodically
    if (loginAttempts.size > 100) {
        for (const [key, val] of loginAttempts) {
            if (now > val.resetAt) loginAttempts.delete(key);
        }
    }
}

function clearAttempts(ip: string): void {
    loginAttempts.delete(ip);
}

async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const ip =
        req.socket.remoteAddress ||
        "unknown";
    if (isRateLimited(ip)) {
        return res
            .status(429)
            .json({ message: "Too many login attempts. Please try again later." });
    }

    const { username, password } = req.body;

    if (
        typeof username === "string" &&
        typeof password === "string" &&
        username.length > 0 &&
        password.length > 0 &&
        safeCompare(username, process.env.AUTH_USERNAME) &&
        safeCompare(password, process.env.AUTH_PASSWORD)
    ) {
        clearAttempts(ip);
        req.session.user = {
            username,
            isLoggedIn: true,
        };
        await req.session.save();
        return res.status(200).json({ message: "ok" });
    }

    recordFailedAttempt(ip);
    return res.status(401).json({ message: "Invalid credentials" });
}

export default withSessionRoute(loginRoute);
