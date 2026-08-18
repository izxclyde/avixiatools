export type UnitDef = {
  name: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
};

export type UnitCategory = {
  id: string;
  name: string;
  units: UnitDef[];
};

const linear = (factor: number): Pick<UnitDef, "toBase" | "fromBase"> => ({
  toBase: (v) => v * factor,
  fromBase: (v) => v / factor,
});

const affine = (toBase: (v: number) => number, fromBase: (v: number) => number) => ({
  toBase,
  fromBase,
});

const u = (name: string, def: Pick<UnitDef, "toBase" | "fromBase">): UnitDef => ({
  name,
  ...def,
});

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    name: "Length",
    units: [
      u("mm", linear(0.001)),
      u("cm", linear(0.01)),
      u("m", linear(1)),
      u("km", linear(1000)),
      u("in", linear(0.0254)),
      u("ft", linear(0.3048)),
      u("yd", linear(0.9144)),
      u("mi", linear(1609.344)),
      u("nmi", linear(1852)),
    ],
  },
  {
    id: "weight",
    name: "Weight",
    units: [
      u("mg", linear(0.000001)),
      u("g", linear(0.001)),
      u("kg", linear(1)),
      u("t", linear(1000)),
      u("oz", linear(0.028349523125)),
      u("lb", linear(0.45359237)),
      u("st", linear(6.35029318)),
    ],
  },
  {
    id: "data",
    name: "Data",
    units: [
      u("B", linear(1)),
      u("KB", linear(1000)),
      u("MB", linear(1e6)),
      u("GB", linear(1e9)),
      u("TB", linear(1e12)),
      u("KiB", linear(1024)),
      u("MiB", linear(1024 ** 2)),
      u("GiB", linear(1024 ** 3)),
    ],
  },
  {
    id: "time",
    name: "Time",
    units: [
      u("ms", linear(0.001)),
      u("s", linear(1)),
      u("min", linear(60)),
      u("h", linear(3600)),
      u("day", linear(86400)),
      u("week", linear(604800)),
    ],
  },
  {
    id: "area",
    name: "Area",
    units: [
      u("mm²", linear(0.000001)),
      u("cm²", linear(0.0001)),
      u("m²", linear(1)),
      u("km²", linear(1e6)),
      u("in²", linear(0.00064516)),
      u("ft²", linear(0.09290304)),
      u("ac", linear(4046.8564224)),
      u("ha", linear(10000)),
    ],
  },
  {
    id: "volume",
    name: "Volume",
    units: [
      u("ml", linear(0.001)),
      u("l", linear(1)),
      u("m³", linear(1000)),
      u("tsp", linear(0.00492892159375)),
      u("tbsp", linear(0.01478676478125)),
      u("fl oz", linear(0.0295735295625)),
      u("cup", linear(0.2365882365)),
      u("pt", linear(0.473176473)),
      u("qt", linear(0.946352946)),
      u("gal", linear(3.785411784)),
    ],
  },
  {
    id: "speed",
    name: "Speed",
    units: [
      u("m/s", linear(1)),
      u("km/h", linear(1 / 3.6)),
      u("mph", linear(0.44704)),
      u("knot", linear(0.514444444444)),
      u("ft/s", linear(0.3048)),
    ],
  },
  {
    id: "temperature",
    name: "Temperature",
    units: [
      u(
        "°C",
        affine(
          (v) => v,
          (v) => v
        )
      ),
      u(
        "°F",
        affine(
          (v) => ((v - 32) * 5) / 9,
          (v) => (v * 9) / 5 + 32
        )
      ),
      u(
        "K",
        affine(
          (v) => v - 273.15,
          (v) => v + 273.15
        )
      ),
    ],
  },
];

export function convertUnit(
  category: UnitCategory,
  value: number,
  fromName: string,
  toName: string
): number {
  const from = category.units.find((unit) => unit.name === fromName);
  const to = category.units.find((unit) => unit.name === toName);
  if (!from || !to) throw new Error("Unknown unit");
  return to.fromBase(from.toBase(value));
}
