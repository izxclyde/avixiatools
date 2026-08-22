import TextDiff from "@/components/tools/text-diff";
import BaseConverter from "@/components/tools/base-converter";
import UnitConverter from "@/components/tools/unit-converter";
import TimeCalc from "@/components/tools/time-calc";
import EncodingTools from "@/components/tools/encoding-tools";
import JsonFormatter from "@/components/tools/json-formatter";
import XmlFormatter from "@/components/tools/xml-formatter";
import SqlConverter from "@/components/tools/sql-converter";
import SqlToCode from "@/components/tools/sql-to-code";
import SqlFormatter from "@/components/tools/sql-formatter";
import QrGenerator from "@/components/tools/qr-generator";
import BarcodeGenerator from "@/components/tools/barcode-generator";
import BackgroundRemover from "@/components/tools/background-remover";
import MergePdf from "@/components/tools/merge-pdf";
import SplitPdf from "@/components/tools/split-pdf";
import OrganizePdf from "@/components/tools/organize-pdf";
import ExtractPdfPages from "@/components/tools/extract-pdf-pages";
import CompressPdf from "@/components/tools/compress-pdf";
import WatermarkPdf from "@/components/tools/watermark-pdf";
import PageNumbers from "@/components/tools/page-numbers";
import JpgToPdf from "@/components/tools/jpg-to-pdf";

export const toolComponents: Record<string, React.ComponentType> = {
  "text-diff": TextDiff,
  "base-converter": BaseConverter,
  "unit-converter": UnitConverter,
  "time-calc": TimeCalc,
  "encoding-tools": EncodingTools,
  "json-formatter": JsonFormatter,
  "xml-formatter": XmlFormatter,
  "sql-converter": SqlConverter,
  "sql-to-code": SqlToCode,
  "sql-formatter": SqlFormatter,
  "qr-generator": QrGenerator,
  "barcode-generator": BarcodeGenerator,
  "background-remover": BackgroundRemover,
  "merge-pdf": MergePdf,
  "split-pdf": SplitPdf,
  "organize-pdf": OrganizePdf,
  "extract-pdf-pages": ExtractPdfPages,
  "compress-pdf": CompressPdf,
  "watermark-pdf": WatermarkPdf,
  "page-numbers": PageNumbers,
  "jpg-to-pdf": JpgToPdf,
};
