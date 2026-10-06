// src/app/api/dashboardPagesAPI/users-and-team/users/helpers.ts
import { randomInt } from "node:crypto";

// BRIXTA_PASSWORD_SECURITY_V1: crypto randomness (Math.random is guessable).
// New code should use generatePassword() from "@/lib/password".
export function generateRandomPassword(length: number = 10): string {
    const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(randomInt(charset.length));
    }
    return password;
}
