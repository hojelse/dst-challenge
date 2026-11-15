const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** The English name of a Country, or the code itself when it is unknown. */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
