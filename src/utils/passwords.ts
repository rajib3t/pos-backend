// src/utils/passwords.ts
import bcrypt from "bcryptjs";
export const hashPassword = async (plain: string) => bcrypt.hash(plain, 12);
export const comparePassword = async (plain: string, hash: string) => bcrypt.compare(plain, hash);
// --- IGNORE ---