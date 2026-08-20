"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; url: string }
  | { state: "error"; message: string };

const ISSUES_URL = "https://github.com/izxclyde/avixiatools/issues";

export function ReportForm() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string | null>("bug");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const submit = async () => {
    setStatus({ state: "submitting" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          details,
          contact,
          honeypot,
          origin: window.location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          state: "error",
          message:
            typeof data.error === "string"
              ? data.error
              : "Something went wrong. Please try again.",
        });
        return;
      }
      setStatus({
        state: "success",
        url: typeof data.url === "string" ? data.url : ISSUES_URL,
      });
      setTitle("");
      setDetails("");
      setContact("");
    } catch {
      setStatus({
        state: "error",
        message: "Could not reach the server. Please try again.",
      });
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="report-title">Title</Label>
        <Input
          id="report-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What went wrong?"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">Bug report</SelectItem>
            <SelectItem value="feature">Feature request</SelectItem>
            <SelectItem value="question">Question</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-details">Details</Label>
        <Textarea
          id="report-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          className="min-h-[180px]"
          placeholder="Steps to reproduce, what you expected, what happened…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-contact">Contact (optional)</Label>
        <Input
          id="report-contact"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Email, Discord, GitHub username…"
        />
      </div>
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="report-website">Website</Label>
        <Input
          id="report-website"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={submit}
          disabled={status.state === "submitting" || !title.trim() || !details.trim()}
        >
          {status.state === "submitting" ? "Submitting…" : "Submit issue"}
        </Button>
      </div>
      {status.state === "success" && (
        <p className="text-sm text-muted-foreground">
          Issue created:{" "}
          <a
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {status.url}
          </a>
        </p>
      )}
      {status.state === "error" && (
        <p className="text-sm text-destructive">{status.message}</p>
      )}
    </div>
  );
}