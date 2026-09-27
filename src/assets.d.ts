// Pictures imported from the code become the URL of the built file.
declare module '*.svg' {
  const url: string
  export default url
}
