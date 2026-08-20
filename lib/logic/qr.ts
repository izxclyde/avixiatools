// Pure QR payload builders (from MIT-licensed delphitools source).

export interface WiFiFormData {
  ssid: string;
  password: string;
  securityType: "nopass" | "WPA" | "WEP";
  isHidden: boolean;
}

export interface VCardData {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

// The ZXing WIFI: spec requires escaping \ ; , " : — unescaped quotes make
// scanners treat the value as hex/quoted rather than literal text
function escapeWiFiValue(value: string): string {
  return value.replace(/[\\;,":]/g, "\\$&");
}

// Format: WIFI:T:{security};S:{ssid};P:{password};H:true;;
// Returns "" while the form is incomplete — a secured network without a
// password would encode an unjoinable QR
export function generateWiFiString(data: WiFiFormData): string {
  const { ssid, password, securityType, isHidden } = data;

  if (!ssid.trim()) return "";
  if (securityType !== "nopass" && !password) return "";

  let wifiString = `WIFI:T:${securityType};S:${escapeWiFiValue(ssid)}`;

  if (securityType !== "nopass") {
    wifiString += `;P:${escapeWiFiValue(password)}`;
  }

  if (isHidden) {
    wifiString += ";H:true";
  }

  return wifiString + ";;";
}

// Build a vCard 3.0 block from contact fields; empty fields are omitted.
export function generateVCardString(data: VCardData): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  if (data.firstName || data.lastName) {
    lines.push(`N:${data.lastName};${data.firstName};;;`);
    lines.push(`FN:${data.firstName} ${data.lastName}`.trim());
  }
  if (data.organization) lines.push(`ORG:${data.organization}`);
  if (data.title) lines.push(`TITLE:${data.title}`);
  if (data.email) lines.push(`EMAIL:${data.email}`);
  if (data.phone) lines.push(`TEL:${data.phone}`);
  if (data.website) lines.push(`URL:${data.website}`);
  if (data.address) lines.push(`ADR:;;${data.address};;;;`);
  lines.push("END:VCARD");
  return lines.join("\n");
}