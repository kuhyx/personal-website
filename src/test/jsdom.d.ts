// The one corner of jsdom the textgate page guard uses. Astro's container
// renders only in the node environment, so that test parses its HTML with
// jsdom directly; jsdom ships no types and this saves a @types dependency.
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string);
    readonly window: Window & typeof globalThis;
  }
}
