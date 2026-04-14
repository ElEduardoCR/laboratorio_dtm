// Inline polyfill script for older Safari/iOS (< 15.4)
// Injected as raw <script> in layout.tsx so it runs before any framework JS

export const POLYFILL_SCRIPT = `
if(!Object.hasOwn){Object.hasOwn=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)}}
if(!Array.prototype.at){Array.prototype.at=function(i){var l=this.length;var k=i>=0?i:l+i;return k>=0&&k<l?this[k]:void 0}}
if(typeof globalThis.AggregateError==="undefined"){globalThis.AggregateError=function(e,m){var err=new Error(m);err.name="AggregateError";err.errors=Array.from(e);return err}}
if(typeof globalThis.structuredClone==="undefined"){globalThis.structuredClone=function(v){return JSON.parse(JSON.stringify(v))}}
`;
