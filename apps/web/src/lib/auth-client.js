import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
export const authClient = createAuthClient({
    baseURL: apiUrl
        ? `${apiUrl}/api/auth`
        : "http://localhost:3001/api/auth",
    plugins: [organizationClient()],
});
export const { signIn, signUp, signOut, useSession, organization, } = authClient;
