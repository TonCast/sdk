// CSS files are loaded as text strings by esbuild (loader: { '.css': 'text' })
// in the IIFE build. Declare the module shape so TypeScript is satisfied.
declare module "*.css" {
  const content: string;
  export default content;
}
