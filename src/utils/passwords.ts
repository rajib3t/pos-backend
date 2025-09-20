// src/utils/passwords.ts
// Password utility functions for secure password handling using bcrypt
import bcrypt from "bcryptjs";

/**
 * Hash a plain text password using bcrypt with salt rounds of 12
 * @param plain - The plain text password to hash
 * @returns Promise<string> - The hashed password
 */
export const hashPassword = async (plain: string): Promise<string> => bcrypt.hash(plain, 12);

/**
 * Compare a plain text password with a hashed password
 * @param plain - The plain text password to compare
 * @param hash - The hashed password to compare against
 * @returns Promise<boolean> - True if passwords match, false otherwise
 */
export const comparePassword = async (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);