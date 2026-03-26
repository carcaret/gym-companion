import { describe, it, expect } from 'vitest'
import { WebCryptoService } from '../WebCryptoService'

const sut = new WebCryptoService()

describe('WebCryptoService', () => {
  describe('hashPassword', () => {
    it('produce el mismo hash para la misma entrada', async () => {
      const a = await sut.hashPassword('mipassword')
      const b = await sut.hashPassword('mipassword')
      expect(a).toBe(b)
    })

    it('produce hashes diferentes para contraseñas distintas', async () => {
      const a = await sut.hashPassword('password1')
      const b = await sut.hashPassword('password2')
      expect(a).not.toBe(b)
    })
  })

  describe('verifyPassword', () => {
    it('retorna true para contraseña correcta', async () => {
      const hash = await sut.hashPassword('secreto')
      expect(await sut.verifyPassword('secreto', hash)).toBe(true)
    })

    it('retorna false para contraseña incorrecta', async () => {
      const hash = await sut.hashPassword('secreto')
      expect(await sut.verifyPassword('otra', hash)).toBe(false)
    })
  })

  describe('xorEncrypt / xorDecrypt', () => {
    it('son inversos: decrypt(encrypt(text)) === text', () => {
      const text = 'mi-token-secreto'
      const key = 'mipassword'
      expect(sut.xorDecrypt(sut.xorEncrypt(text, key), key)).toBe(text)
    })

    it('el texto cifrado cambia con distinta clave', () => {
      const text = 'mi-token'
      expect(sut.xorEncrypt(text, 'key1')).not.toBe(sut.xorEncrypt(text, 'key2'))
    })
  })
})
