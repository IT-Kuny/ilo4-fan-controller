import { useState } from "react";
import { useRouter } from "next/router";
import { Fade } from "react-awesome-reveal";
import toast from "react-hot-toast";
import { withSessionSsr } from "../lib/session";

const Login = (): JSX.Element => {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                router.push("/");
            } else {
                const data = await response.json();
                toast.error(data.message || "Login failed");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-screen px-2 pt-4 text-white bg-gray-800 sm:flex sm:justify-center sm:items-center sm:pt-0">
            <Fade direction="up" triggerOnce>
                <div className="container w-full pt-6 pb-6 duration-150 bg-gray-900 border-2 border-gray-700 rounded shadow-xl sm:px-12 sm:max-w-md">
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <img src="/ilo-logo.png" alt="iLO Logo" />
                        <h1 className="text-xl font-semibold">
                            iLO Fan Controller
                        </h1>
                    </div>
                    <form onSubmit={handleSubmit} className="px-8 sm:px-0">
                        <div className="mb-4">
                            <label
                                htmlFor="username"
                                className="block mb-2 text-sm font-medium"
                            >
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3 py-2 text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-cyan-500"
                                required
                                autoComplete="username"
                            />
                        </div>
                        <div className="mb-6">
                            <label
                                htmlFor="password"
                                className="block mb-2 text-sm font-medium"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-cyan-500"
                                required
                                autoComplete="current-password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full px-6 py-2 font-semibold duration-150 rounded disabled:bg-gray-500 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-700 text-cyan-50"
                        >
                            {submitting ? "Logging in..." : "Log in"}
                        </button>
                    </form>
                </div>
            </Fade>
        </div>
    );
};

export const getServerSideProps = withSessionSsr(async function ({ req }) {
    const user = req.session.user;

    if (user?.isLoggedIn) {
        return {
            redirect: {
                destination: "/",
                permanent: false,
            },
        };
    }

    return {
        props: {},
    };
});

export default Login;
