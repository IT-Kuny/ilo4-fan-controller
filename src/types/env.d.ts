declare namespace NodeJS {
    interface ProcessEnv {
        ILO_HOST: string;
        ILO_USERNAME: string;
        ILO_PASSWORD: string;
        AUTH_USERNAME: string;
        AUTH_PASSWORD: string;
        SESSION_SECRET: string;
    }
}
