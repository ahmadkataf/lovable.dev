// Pieces cut from a sheet other than the design's main one carry a material tag. Each material is laid out in its own
// block and exported in its own colour and layer, so RDWorks can cut one sheet at a time (turn the other layers off).
export interface MaterialInfo { label: string; hex: string; rgb: string; cmyk: string; aci: number; fill: string }

export const MATERIAL_INFO: Record<string, MaterialInfo> = {
  mirror: { label: 'أكريليك مرآة ذهبي أو فضي', hex: '#00a000', rgb: '0 160 0', cmyk: '1 0 1 0.37', aci: 3, fill: '#e3cf8c' },
  white: { label: 'أكريليك أبيض', hex: '#ff00ff', rgb: '255 0 255', cmyk: '0 1 0 0', aci: 6, fill: '#f6f6f6' },
  black: { label: 'أكريليك أسود', hex: '#ff8000', rgb: '255 128 0', cmyk: '0 0.5 1 0', aci: 30, fill: '#4a4a4a' },
}
export const COLOUR_NAME: Record<string, string> = { '#ff0000': 'الأحمر', '#00a000': 'الأخضر', '#ff00ff': 'البنفسجي', '#ff8000': 'البرتقالي' }
