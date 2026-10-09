/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const content: string;
  export default content;
}

declare module '*.sql?raw' {
  const content: string;
  export default content;
}

declare module 'html2pdf.js';

