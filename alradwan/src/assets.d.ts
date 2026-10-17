// Vite turns `import x from './file?url'` into the URL of the file in the build.
declare module '*?url' {
  const url: string
  export default url
}
