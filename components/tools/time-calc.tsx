"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyRow, StatBox } from "@/components/tools/shared";
import {
  nowUnix,
  unixToDate,
  dateToUnix,
  formatUnix,
  addToDate,
  weekdayName,
  formatInTimezone,
  timezoneOffset,
  dateDiffDays,
} from "@/lib/logic/dates";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function UnixTab() {
  const [ts, setTs] = useState("");
  const [datetime, setDatetime] = useState("");

  const tsNum = Number(ts);
  const parsed = Number.isFinite(tsNum) && ts !== "" ? formatUnix(tsNum) : null;
  const local =
    parsed !== null ? unixToDate(tsNum).toString() : null;

  const datetimeNum = datetime
    ? dateToUnix(new Date(datetime))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ts">Unix timestamp (seconds)</Label>
          <div className="flex gap-2">
            <Input
              id="ts"
              value={ts}
              onChange={(e) => setTs(e.target.value)}
              placeholder={String(nowUnix())}
              className="font-mono"
            />
            <Button
              variant="secondary"
              onClick={() => setTs(String(nowUnix()))}
            >
              Now
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dt">Date & time</Label>
          <Input
            id="dt"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>
      </div>

      {parsed !== null && (
        <div className="flex flex-col gap-2">
          <CopyRow label="Human-readable" value={parsed} mono={false} />
          <CopyRow label="Full (local)" value={local ?? ""} mono={false} />
        </div>
      )}
      {datetimeNum !== null && (
        <CopyRow label="Unix timestamp" value={String(datetimeNum)} />
      )}
    </div>
  );
}

function ArithmeticTab() {
  const [date, setDate] = useState("2026-01-31");
  const [days, setDays] = useState("0");
  const [months, setMonths] = useState("1");
  const [years, setYears] = useState("0");

  const start = new Date(date);
  const valid = !isNaN(start.getTime());
  const result = valid
    ? addToDate(start, {
        days: Number(days),
        months: Number(months),
        years: Number(years),
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="date">Start date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="days">Days</Label>
          <Input
            id="days"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="months">Months</Label>
          <Input
            id="months"
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="years">Years</Label>
          <Input
            id="years"
            type="number"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Result" value={result.toLocaleDateString()} />
          <StatBox label="Weekday" value={weekdayName(result)} />
          <StatBox
            label="Days difference"
            value={String(dateDiffDays(start, result))}
          />
          <StatBox label="ISO" value={result.toISOString().slice(0, 10)} />
        </div>
      )}
    </div>
  );
}

function TimezoneTab() {
  const [datetime, setDatetime] = useState(
    new Date(nowUnix() * 1000 - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  );
  const [from, setFrom] = useState("UTC");
  const [to, setTo] = useState("Asia/Tokyo");

  const date = new Date(datetime);
  const valid = !isNaN(date.getTime());

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tz-dt">Date & time</Label>
          <Input
            id="tz-dt"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>From</Label>
          <Select value={from} onValueChange={(v) => v && setFrom(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>To</Label>
          <Select value={to} onValueChange={(v) => v && setTo(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {valid && (
        <div className="flex flex-col gap-2">
          <CopyRow
            label={`In ${from}`}
            value={`${formatInTimezone(date, from)} (${timezoneOffset(date, from)})`}
            mono={false}
          />
          <CopyRow
            label={`In ${to}`}
            value={`${formatInTimezone(date, to)} (${timezoneOffset(date, to)})`}
            mono={false}
          />
        </div>
      )}
    </div>
  );
}

export default function TimeCalc() {
  return (
    <Tabs defaultValue="unix">
      <TabsList>
        <TabsTrigger value="unix">Unix timestamp</TabsTrigger>
        <TabsTrigger value="arithmetic">Date arithmetic</TabsTrigger>
        <TabsTrigger value="timezone">Timezones</TabsTrigger>
      </TabsList>
      <TabsContent value="unix">
        <UnixTab />
      </TabsContent>
      <TabsContent value="arithmetic">
        <ArithmeticTab />
      </TabsContent>
      <TabsContent value="timezone">
        <TimezoneTab />
      </TabsContent>
    </Tabs>
  );
}