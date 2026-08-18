export const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export function isValidNumber(value: string, base: number): boolean {
  if (base < 2 || base > 36) return false;
  const clean = value.replace(/^[+-]/, "").toLowerCase();
  if (clean.length === 0) return false;
  return [...clean].every((ch) => DIGITS.indexOf(ch) >= 0 && DIGITS.indexOf(ch) < base);
}

export function convertBase(value: string, fromBase: number, toBase: number): string {
  if (!isValidNumber(value, fromBase) || toBase < 2 || toBase > 36) {
    throw new Error("Invalid base conversion input");
  }
  const sign = value.startsWith("-") ? "-" : "";
  const clean = value.replace(/^[+-]/, "").toLowerCase();
  const big = [...clean].reduce(
    (acc, ch) => acc * BigInt(fromBase) + BigInt(DIGITS.indexOf(ch)),
    BigInt(0)
  );
  if (big === BigInt(0)) return "0";
  let out = "";
  let n = big;
  while (n > BigInt(0)) {
    out = DIGITS[Number(n % BigInt(toBase))] + out;
    n = n / BigInt(toBase);
  }
  return sign + out;
}
