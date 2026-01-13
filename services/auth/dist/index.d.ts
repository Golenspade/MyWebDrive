import express from 'express';
export declare const app: express.Express;
declare function signAccess(userId: string, role: string): string;
declare function signRefresh(userId: string): string;
export { signAccess, signRefresh };
