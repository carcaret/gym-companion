export interface ICryptoService {
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, hash: string): Promise<boolean>
  xorEncrypt(text: string, key: string): string
  xorDecrypt(encoded: string, key: string): string
}
