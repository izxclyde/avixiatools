const REPO = "izxclyde/avixiatools";
const MAX_TITLE = 300;
const MAX_DETAILS = 5000;

const TYPE_LABELS: Record<string, string> = {
  bug: "bug",
  feature: "enhancement",
  question: "question",
};

type ReportPayload = {
  title?: unknown;
  details?: unknown;
  type?: unknown;
  contact?: unknown;
  honeypot?: unknown;
  origin?: unknown;
};

export async function POST(request: Request) {
  if (!process.env.GITHUB_TOKEN) {
    return Response.json(
      { error: "Issue reporting is not configured on this deployment." },
      { status: 503 }
    );
  }

  let payload: ReportPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Bots fill the hidden honeypot field; skip the request silently.
  if (payload.honeypot) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const details = typeof payload.details === "string" ? payload.details.trim() : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  const contact = typeof payload.contact === "string" ? payload.contact.trim().slice(0, 500) : "";
  const origin = typeof payload.origin === "string" ? payload.origin.trim().slice(0, 200) : "";

  if (!title || title.length > MAX_TITLE) {
    return Response.json(
      { error: `Title is required and must be ${MAX_TITLE} characters or fewer.` },
      { status: 400 }
    );
  }
  if (!details || details.length > MAX_DETAILS) {
    return Response.json(
      { error: `Details are required and must be ${MAX_DETAILS} characters or fewer.` },
      { status: 400 }
    );
  }

  const body = [details, "", "---", contact ? `**Contact:** ${contact}` : null, origin ? `**Reported from:** ${origin}` : null]
    .filter(Boolean)
    .join("\n");

  const labels = TYPE_LABELS[type] ? [TYPE_LABELS[type]] : [];

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = typeof data.message === "string" ? data.message : "GitHub API error.";
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ url: data.html_url }, { status: 201 });
}