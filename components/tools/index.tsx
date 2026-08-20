import TextDiff from "@/components/tools/text-diff";
import BaseConverter from "@/components/tools/base-converter";
import UnitConverter from "@/components/tools/unit-converter";
import TimeCalc from "@/components/tools/time-calc";
import EncodingTools from "@/components/tools/encoding-tools";
import JsonFormatter from "@/components/tools/json-formatter";
import XmlFormatter from "@/components/tools/xml-formatter";
import SqlConverter from "@/components/tools/sql-converter";
import SqlFormatter from "@/components/tools/sql-formatter";

export const toolComponents: Record<string, React.ComponentType> = {
  "text-diff": TextDiff,
  "base-converter": BaseConverter,
  "unit-converter": UnitConverter,
  "time-calc": TimeCalc,
  "encoding-tools": EncodingTools,
  "json-formatter": JsonFormatter,
  "xml-formatter": XmlFormatter,
  "sql-converter": SqlConverter,
  "sql-formatter": SqlFormatter,
};
