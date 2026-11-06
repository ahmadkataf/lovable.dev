// Vite/vitest "?raw" imports (a file's text), used to check the Worker's output against the web sources.
declare module '*?raw' {
  const text: string
  export default text
}
