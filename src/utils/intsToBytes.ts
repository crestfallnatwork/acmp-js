export function uintToBytes(num: number, size: number): Uint8Array{
    let bytes = new Uint8Array(size)
    let numHex = Array.from(num.toString(16))
    if (numHex.length < bytes.length*2) {
        numHex = Array(bytes.length*2 - numHex.length).fill('0').concat(numHex)
    }
    numHex = numHex.slice(numHex.length - (bytes.length * 2))
    bytes.forEach((_, i) => {
        const strI = i * 2
        bytes[i] = bytes[i] | parseInt(numHex.slice(strI, strI + 2).join(''), 16)
    })
    return bytes
}

export function bytesToUint(bytes: Uint8Array): number {
    let res = 0
    for (const v of bytes.values()) {
        res <<= 8
        res += v
    }
    return res
}
