const CRC_TABLE = (() => {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data) {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function toBytes(str) { return new TextEncoder().encode(str) }
function u16(n) { return [n & 0xff, (n >>> 8) & 0xff] }
function u32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff] }

export default class ZipStream {
  constructor(options) {
    this.onData = options.onData
    this.entries = []
    this.offset = 0
  }

  emit(bytes) {
    const chunk = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    this.onData(chunk)
    this.offset += chunk.length
  }

  addFile(name, data) {
    const nameBytes = toBytes(name)
    const crc = crc32(data)
    const size = data.length
    const entryOffset = this.offset

    const header = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0),
    ]
    this.emit(header)
    this.emit(nameBytes)
    this.emit(data)

    this.entries.push({ nameBytes, crc, size, offset: entryOffset })
  }

  finish() {
    const centralStart = this.offset
    for (const e of this.entries) {
      const central = [
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.nameBytes.length),
        ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset),
      ]
      this.emit(central)
      this.emit(e.nameBytes)
    }
    const centralSize = this.offset - centralStart
    const end = [
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(this.entries.length), ...u16(this.entries.length),
      ...u32(centralSize), ...u32(centralStart), ...u16(0),
    ]
    this.emit(end)
  }
}