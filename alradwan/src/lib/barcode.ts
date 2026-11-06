// Code 128 (set B, with set C for runs of digits) drawn as SVG: labels for the shelves, readable by any scanner.

const PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000', '11010011100', '1100011101011',
]
const START_B = 104, START_C = 105, CODE_B = 100, CODE_C = 99, STOP = 106

/** The bar pattern (a string of 1/0) of a text, or null when it holds characters Code 128 B cannot carry. */
export function code128(text: string): string | null {
  if (!text || /[^\x20-\x7e]/.test(text)) return null
  const codes: number[] = []
  let i = 0
  let set: 'B' | 'C' | null = null
  const digitsAhead = (k: number) => { let n = 0; while (k + n < text.length && /\d/.test(text[k + n])) n++; return n }
  while (i < text.length) {
    const d = digitsAhead(i)
    if (d >= 4 || (d >= 2 && i + d === text.length && d % 2 === 0)) {
      if (set !== 'C') { codes.push(set === null ? START_C : CODE_C); set = 'C' }
      const pairs = Math.floor(d / 2)
      for (let p = 0; p < pairs; p++) { codes.push(parseInt(text.substr(i, 2), 10)); i += 2 }
      continue
    }
    if (set !== 'B') { codes.push(set === null ? START_B : CODE_B); set = 'B' }
    codes.push(text.charCodeAt(i) - 32); i++
  }
  let sum = codes[0]
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k
  codes.push(sum % 103, STOP)
  return codes.map(c => PATTERNS[c]).join('')
}

/** An SVG barcode with the text under it. */
export function barcodeSvg(text: string, opts?: { height?: number; module?: number; showText?: boolean }): string {
  const bits = code128(text)
  const h = opts?.height ?? 40, m = opts?.module ?? 2, showText = opts?.showText ?? true
  if (!bits) return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="${h}"><text x="0" y="${h / 2}" font-size="10">${text.replace(/[<&]/g, '')}</text></svg>`
  const quiet = 10 * m
  const w = bits.length * m + quiet * 2
  let rects = ''
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') { let j = i; while (j < bits.length && bits[j] === '1') j++; rects += `<rect x="${quiet + i * m}" y="0" width="${(j - i) * m}" height="${h}"/>`; i = j - 1 }
  const textH = showText ? 12 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + textH}" viewBox="0 0 ${w} ${h + textH}" shape-rendering="crispEdges"><g fill="#000">${rects}</g>${showText ? `<text x="${w / 2}" y="${h + 10}" text-anchor="middle" font-family="monospace" font-size="10" fill="#000">${text.replace(/[<&]/g, '')}</text>` : ''}</svg>`
}
