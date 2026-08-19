import ColourConverter from "@/components/tools/colour-converter";
import ContrastChecker from "@/components/tools/contrast-checker";
import GradientGenerator from "@/components/tools/gradient-generator";
import TailwindShades from "@/components/tools/tailwind-shades";
import PaletteGenerator from "@/components/tools/palette-generator";
import WordCounter from "@/components/tools/word-counter";
import PxToRem from "@/components/tools/px-to-rem";
import LineHeightCalc from "@/components/tools/line-height-calc";
import TypoCalc from "@/components/tools/typo-calc";
import PaperSizes from "@/components/tools/paper-sizes";
import TextDiff from "@/components/tools/text-diff";
import BaseConverter from "@/components/tools/base-converter";
import UnitConverter from "@/components/tools/unit-converter";
import TimeCalc from "@/components/tools/time-calc";
import EncodingTools from "@/components/tools/encoding-tools";
import JsonFormatter from "@/components/tools/json-formatter";
import XmlFormatter from "@/components/tools/xml-formatter";

export const toolComponents: Record<string, React.ComponentType> = {
  "colour-converter": ColourConverter,
  "contrast-checker": ContrastChecker,
  "gradient-generator": GradientGenerator,
  "tailwind-shades": TailwindShades,
  "palette-generator": PaletteGenerator,
  "word-counter": WordCounter,
  "px-to-rem": PxToRem,
  "line-height-calc": LineHeightCalc,
  "typo-calc": TypoCalc,
  "paper-sizes": PaperSizes,
  "text-diff": TextDiff,
  "base-converter": BaseConverter,
  "unit-converter": UnitConverter,
  "time-calc": TimeCalc,
  "encoding-tools": EncodingTools,
  "json-formatter": JsonFormatter,
  "xml-formatter": XmlFormatter,
};
