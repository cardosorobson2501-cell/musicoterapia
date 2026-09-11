/**
 * Gera os ícones do PWA sem depender de biblioteca de imagem.
 *
 * Desenha num buffer RGBA (fundo arredondado + nota musical) e codifica o PNG
 * à mão: cabeçalho, IHDR, IDAT comprimido com zlib e IEND. É pouco código e
 * evita arrastar uma dependência de build só para isso.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [74, 110, 224, 255] // azul da marca
const FG = [255, 255, 255, 255] // nota musical

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  // Cada linha do PNG é prefixada pelo byte de filtro (0 = nenhum).
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4)
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = color[0]
    buf[i + 1] = color[1]
    buf[i + 2] = color[2]
    buf[i + 3] = color[3]
  }

  // Fundo. O ícone "maskable" precisa sangrar até a borda, porque o Android
  // recorta a forma que quiser; o comum leva cantos arredondados.
  const r = maskable ? 0 : size * 0.22
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true
      if (r > 0) {
        const cx = Math.min(Math.max(x, r), size - r)
        const cy = Math.min(Math.max(y, r), size - r)
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r
      }
      if (inside) put(x, y, BG)
    }
  }

  // Nota musical. O conteúdo fica dentro de 60% centrais no ícone maskable,
  // que é a área segura garantida pelo Android.
  const s = maskable ? size * 0.6 : size * 0.78
  const ox = (size - s) / 2
  const oy = (size - s) / 2
  const u = s / 100 // unidade de desenho, sobre uma grade de 100x100

  const headCx = ox + 33 * u
  const headCy = oy + 76 * u
  const headRx = 20 * u
  const headRy = 15 * u
  const stemX = ox + 51 * u
  const stemW = 6.5 * u
  const stemTop = oy + 12 * u

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Cabeça: elipse levemente inclinada, como numa partitura.
      const dx = x - headCx
      const dy = y - headCy
      const rot = -0.32
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot)
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot)
      if ((rx / headRx) ** 2 + (ry / headRy) ** 2 <= 1) put(x, y, FG)

      // Haste.
      if (x >= stemX && x <= stemX + stemW && y >= stemTop && y <= headCy + 3 * u) {
        put(x, y, FG)
      }

      // Bandeira, descendo da ponta da haste. A largura afina até zero para
      // terminar em ponta, e não num degrau.
      const fx = x - (stemX + stemW)
      const fy = y - stemTop
      if (fx >= 0 && fy >= 0 && fy <= 38 * u) {
        const width = 19 * u * (1 - (fy / (38 * u)) ** 1.7)
        if (fx <= Math.max(width, 0)) put(x, y, FG)
      }
    }
  }

  return encodePng(size, size, buf)
}

mkdirSync(OUT, { recursive: true })

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: false }],
]

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), draw(size, opts))
  console.log('gerado:', name, `${size}x${size}`)
}
