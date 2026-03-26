import type { ICryptoService } from '../../domain/auth/ICryptoService'

const SALT = 'GYMPRO_SALT_2024'

export class WebCryptoService implements ICryptoService {
  async hashPassword(password: string): Promise<string> {
    const input = SALT + password
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return (await this.hashPassword(password)) === hash
  }

  xorEncrypt(text: string, key: string): string {
    return Array.from(text)
      .map((c, i) => (c.charCodeAt(0) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0'))
      .join('')
  }

  xorDecrypt(hex: string, key: string): string {
    const bytes = hex.match(/.{2}/g) ?? []
    return bytes
      .map((b, i) => String.fromCharCode(parseInt(b, 16) ^ key.charCodeAt(i % key.length)))
      .join('')
  }
}
