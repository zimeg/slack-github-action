declare module "flat" {
  /** Customizations for the flattening function. */
  type Options = {
    /** The seperator to use between attributes. */
    delimiter: string;
  };

  /**
   * @param payload - The nested objected to unnest.
   * @param options - Customizations to flattenings.
   * @returns an object with all attributes at the top level.
   */
  export default function flatten(payload: object, options: Options): object;
}
