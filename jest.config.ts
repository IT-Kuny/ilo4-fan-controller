import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
    testMatch: ["**/__tests__/**/*.(test|spec).ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};

export default config;
