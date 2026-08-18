"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CopyRow } from "@/components/tools/shared";
import {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  md5Hex,
  sha1Hex,
  sha256Hex,
  sha512Hex,
} from "@/lib/logic/hash";

function EncoderTab({
  encode,
  decode,
  encodeLabel,
  decodeLabel,
}: {
  encode: (text: string) => string | null;
  decode: (text: string) => string | null;
  encodeLabel: string;
  decodeLabel: string;
}) {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="enc-text">Input</Label>
        <Textarea
          id="enc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste here…"
          className="min-h-[120px] font-mono text-sm"
        />
      </div>
      <div className="flex flex-col gap-2">
        <CopyRow label={encodeLabel} value={encode(text) ?? "—"} />
        <CopyRow label={decodeLabel} value={decode(text) ?? "—"} />
      </div>
    </div>
  );
}

function HashTab() {
  const [text, setText] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (!text) {
      setHashes({});
      return;
    }
    Promise.all([sha1Hex(text), sha256Hex(text), sha512Hex(text)]).then(
      ([sha1, sha256, sha512]) => {
        if (!cancelled) setHashes({ sha1, sha256, sha512 });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="hash-text">Input</Label>
        <Textarea
          id="hash-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste here…"
          className="min-h-[120px] font-mono text-sm"
        />
      </div>
      <div className="flex flex-col gap-2">
        <CopyRow label="MD5" value={text ? md5Hex(text) : "—"} />
        <CopyRow label="SHA-1" value={text ? (hashes.sha1 ?? "…") : "—"} />
        <CopyRow label="SHA-256" value={text ? (hashes.sha256 ?? "…") : "—"} />
        <CopyRow label="SHA-512" value={text ? (hashes.sha512 ?? "…") : "—"} />
      </div>
    </div>
  );
}

export default function EncodingTools() {
  return (
    <Tabs defaultValue="base64">
      <TabsList>
        <TabsTrigger value="base64">Base64</TabsTrigger>
        <TabsTrigger value="url">URL</TabsTrigger>
        <TabsTrigger value="hash">Hashes</TabsTrigger>
      </TabsList>
      <TabsContent value="base64">
        <EncoderTab
          encode={base64Encode}
          decode={base64Decode}
          encodeLabel="Encoded"
          decodeLabel="Decoded"
        />
      </TabsContent>
      <TabsContent value="url">
        <EncoderTab
          encode={urlEncode}
          decode={urlDecode}
          encodeLabel="URL-encoded"
          decodeLabel="URL-decoded"
        />
      </TabsContent>
      <TabsContent value="hash">
        <HashTab />
      </TabsContent>
    </Tabs>
  );
}