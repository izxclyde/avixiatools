"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(async (id: string, text: string, label?: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      setStatusMessage(label ? `Copied ${label} to clipboard` : "Copied to clipboard");
      timeoutRef.current = setTimeout(() => {
        setCopiedId(null);
        setStatusMessage("");
      }, 1500);
      return true;
    } catch {
      setStatusMessage("Failed to copy to clipboard");
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copiedId, copy, statusMessage };
}

