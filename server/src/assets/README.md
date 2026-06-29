# Server assets

Place the Vegam logo here as **`vegam-logo.png`** (PNG or JPG). It is embedded,
left-aligned, in generated invoice PDFs ([../services/invoicePdf.ts](../services/invoicePdf.ts)).

If the file is absent, the PDF falls back to a "VEGAM" text wordmark so
generation never fails.

Recommended: a transparent-background PNG roughly 320×120 px (it is scaled to
fit a 160×60 box).
