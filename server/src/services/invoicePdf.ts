/**
 * Invoice PDF generation (PDFKit).
 *
 * Produces a self-contained A4 invoice: Vegam logo (left-aligned), invoice
 * number and dates, billed-to customer, an itemized table of the POs being
 * billed with their descriptions, and the total. The logo is read from
 * assets/vegam-logo.png when present; otherwise a "VEGAM" wordmark is drawn so
 * PDF generation never fails for a missing asset.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const ACCENT = '#1677ff';
const MUTED = '#8c8c8c';
const BORDER = '#e0e0e0';

const LOGO_PATH = path.join(__dirname, '../assets/vegam-logo.png');
const INVOICE_DIR = path.join(__dirname, '../../uploads/invoices');

export interface InvoicePdfLineItem {
  poNumber: string;
  description: string;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: Date;
  payByDate: Date;
  currency: string;
  customerName: string;
  customerAddress?: string;
  lineItems: InvoicePdfLineItem[];
  taxAmount?: number;
  taxDescription?: string;
}

function money(currency: string, value: number): string {
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Render the invoice to a PDF file under uploads/invoices and resolve with the
 * absolute file path once fully written.
 */
export function generateInvoicePdf(data: InvoicePdfData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });
      const filePath = path.join(INVOICE_DIR, `${data.invoiceNumber}.pdf`);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      // ── Header: logo (left) + INVOICE title (right) ──────────────────────────
      const headerTop = doc.y;
      if (fs.existsSync(LOGO_PATH)) {
        try {
          doc.image(LOGO_PATH, pageLeft, headerTop, { fit: [160, 60] });
        } catch (err) {
          console.error('[invoicePdf] Failed to embed logo:', err);
          doc.fontSize(26).fillColor(ACCENT).font('Helvetica-Bold').text('VEGAM', pageLeft, headerTop);
        }
      } else {
        console.warn('[invoicePdf] Logo not found at:', LOGO_PATH);
        doc.fontSize(26).fillColor(ACCENT).font('Helvetica-Bold').text('VEGAM', pageLeft, headerTop);
      }

      doc.fontSize(24).fillColor('#000').font('Helvetica-Bold')
        .text('INVOICE', pageLeft, headerTop + 4, { align: 'right' });
      doc.fontSize(10).fillColor(MUTED).font('Helvetica')
        .text(data.invoiceNumber, pageLeft, headerTop + 34, { align: 'right' });

      // ── Meta block ───────────────────────────────────────────────────────────
      let y = headerTop + 90;
      doc.fontSize(9).fillColor(MUTED).font('Helvetica');
      doc.text('BILLED TO', pageLeft, y);
      doc.text('INVOICE DATE', pageLeft + contentWidth - 200, y, { width: 90 });
      doc.text('PAY BY', pageLeft + contentWidth - 100, y, { width: 100 });

      y += 14;
      doc.fontSize(11).fillColor('#000').font('Helvetica-Bold')
        .text(data.customerName, pageLeft, y, { width: contentWidth - 220 });
      doc.fontSize(10).font('Helvetica')
        .text(formatDate(data.invoiceDate), pageLeft + contentWidth - 200, y, { width: 90 })
        .text(formatDate(data.payByDate), pageLeft + contentWidth - 100, y, { width: 100 });

      if (data.customerAddress) {
        y += 16;
        doc.fontSize(9).fillColor(MUTED).font('Helvetica')
          .text(data.customerAddress, pageLeft, y, { width: contentWidth - 220 });
      }

      // ── Line-item table ────────────────────────────────────────────────────────
      y += 40;
      const colPo = pageLeft;
      const colDesc = pageLeft + 130;
      const colAmt = pageRight - 110;

      // Header row
      doc.rect(pageLeft, y, contentWidth, 22).fill('#f5f5f5');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
      doc.text('PO NUMBER', colPo + 6, y + 7);
      doc.text('DESCRIPTION', colDesc, y + 7);
      doc.text('AMOUNT', colAmt, y + 7, { width: 104, align: 'right' });
      y += 22;

      doc.font('Helvetica').fontSize(10).fillColor('#000');
      for (const item of data.lineItems) {
        const descHeight = doc.heightOfString(item.description || '—', { width: colAmt - colDesc - 10 });
        const rowHeight = Math.max(22, descHeight + 12);

        doc.fillColor('#000').font('Helvetica-Bold').fontSize(9.5)
          .text(item.poNumber, colPo + 6, y + 6, { width: colDesc - colPo - 10 });
        doc.font('Helvetica').fontSize(9.5).fillColor('#333')
          .text(item.description || '—', colDesc, y + 6, { width: colAmt - colDesc - 10 });
        doc.fillColor('#000').fontSize(9.5)
          .text(money(data.currency, item.amount), colAmt, y + 6, { width: 104, align: 'right' });

        y += rowHeight;
        doc.moveTo(pageLeft, y).lineTo(pageRight, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      }

      // ── Totals ───────────────────────────────────────────────────────────────
      const subtotal = data.lineItems.reduce((s, i) => s + i.amount, 0);
      const tax = data.taxAmount || 0;
      const total = subtotal + tax;

      y += 12;
      const totalsLabelX = colAmt - 90;
      const totalsValX = colAmt - 20;
      doc.fontSize(10).font('Helvetica').fillColor(MUTED);
      doc.text('Subtotal', totalsLabelX, y, { width: 80, align: 'right' });
      doc.fillColor('#000').text(money(data.currency, subtotal), totalsValX, y, { width: 124, align: 'right' });

      if (tax > 0) {
        y += 18;
        doc.fillColor(MUTED).text(data.taxDescription || 'Tax', totalsLabelX, y, { width: 80, align: 'right' });
        doc.fillColor('#000').text(money(data.currency, tax), totalsValX, y, { width: 124, align: 'right' });
      }

      y += 24;
      doc.moveTo(totalsLabelX, y).lineTo(pageRight, y).strokeColor(ACCENT).lineWidth(1).stroke();
      y += 8;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000');
      doc.text('TOTAL', totalsLabelX, y, { width: 80, align: 'right' });
      doc.fillColor(ACCENT).text(money(data.currency, total), totalsValX, y, { width: 124, align: 'right' });

      // ── Footer ───────────────────────────────────────────────────────────────
      doc.fontSize(8).fillColor(MUTED).font('Helvetica')
        .text(
          'This is a system-generated invoice from Vegam Revenue Management.',
          pageLeft,
          doc.page.height - doc.page.margins.bottom - 20,
          { width: contentWidth, align: 'center' }
        );

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
