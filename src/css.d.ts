// Metro bundles CSS (global.css / *.module.css from the starter template), but plain `tsc` doesn't
// know about them — declare the modules so type-checking passes. (The app build is unaffected either way.)
declare module '*.css';
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
