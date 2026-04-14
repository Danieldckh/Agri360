// Builds the full booking form HTML snippet that gets injected into
// the editor service's base.html template at <!--CONTENT_SNIPPET-->.
//
// The snippet includes:
//  1. Company information table
//  2. Contact details table
//  3. Deliverables table (with column headers + formatted rows)
//  4. Footer section (terms, totals, sign-off)

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function editableCell(content) {
  return `<td><div class="editable" contenteditable="true">${content || ''}</div></td>`;
}

function buildBookingFormSnippet(formData, form, deliverableRows) {
  const ci = formData.client_information || {};
  const fin = formData.financial_totals || {};
  const signOff = formData.sign_off || {};
  const currency = formData.financial_currency || 'R';

  const companyName = ci.company_name || form.clientName || '';
  const tradingName = ci.trading_name || form.tradingName || '';

  // Styles for the booking form (works in both editor and e-sign contexts)
  const styleOverrides = `<style>
.admin-btn, #admin-notion-btn { display: none !important; }
.booking-table td:first-child { width: 50%; }
.bf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.bf-header img { height: 70px; object-fit: contain; }
.bf-header .bf-address { text-align: right; font-size: 13px; color: #D72626; font-weight: 600; line-height: 1.5; }
.bf-legal { text-align: center; font-size: 13px; font-weight: 600; color: #222; margin: 8px 0 24px; padding-top: 8px; border-top: 1px solid #cfcfcf; }
.company-table, .contact-table, .booking-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
.company-table td, .contact-table td, .booking-table td { border: 1px solid #e0e0e0; padding: 8px 10px; font-size: 13px; vertical-align: top; }
.company-table tr:nth-child(odd) td, .contact-table tr:first-child td { background: #f5f5f5; }
.contact-table tr:nth-child(odd) td { background: #f5f5f5; }
.booking-table tr:first-child td { background: #f5f5f5; font-weight: 600; }
.footer-section { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start; margin-top: 20px; }
.footer-left { flex: 1; font-size: 12px; line-height: 1.6; color: #555; }
.footer-right { flex: 0 0 240px; }
.bf-section-title { font-size: 16px; font-weight: 800; text-transform: uppercase; color: #222; margin: 24px 0 8px; letter-spacing: 0.5px; }
</style>`;

  const campaignStart = ci.campaign_start || form.campaignMonthStart || '';
  const campaignEnd = ci.campaign_end || form.campaignMonthEnd || '';

  // Primary contact
  const pc = ci.primary_contact || {};
  const mc = ci.material_contact || {};
  const ac = ci.accounts_contact || {};

  // Format campaign range for display
  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  function fmtMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return (MONTHS[m] || '') + ' ' + (y || '');
  }
  const campaignRange = campaignStart && campaignEnd
    ? fmtMonth(campaignStart) + ' - ' + fmtMonth(campaignEnd)
    : '';

  const parts = [styleOverrides];

  // ─── Header: Logo + Address + Legal Strip ───
  parts.push(`
<div class="bf-header header">
  <button class="logo-btn" type="button" id="logo-upload-btn" aria-label="Company logo">
    <img id="header-logo" src="https://checklist.proagrihub.com/ProAgriMedia-CheckList.png" alt="ProAgri Media">
  </button>
  <div class="bf-address address" id="header-address">
    PO Box 72707, Lynnwood Ridge, 0040<br>
    33 Oakwood Close, Silverwoods Country Estate<br>
    Tel: 084 088 0123 | Fax: 086 458 7812
  </div>
</div>
<div class="bf-legal legal-strip" id="legal-strip">
  Agri Media Africa (Pty) Ltd. | Reg no: 2019/486053/07 | VAT no: 409 0303 266 | Director: Mrs. D Do Nacimento
</div>`);

  // ─── Company Information Table ───
  parts.push(`
<div class="bf-section-title">Company Information</div>
<div class="booking-table-wrapper">
  <table class="company-table">
    <tr>
      ${editableCell('<b>Full Company Name</b>')}
      ${editableCell(esc(companyName))}
      ${editableCell('<b>Trading Name</b>')}
      ${editableCell(esc(tradingName))}
    </tr>
    <tr>
      ${editableCell('<b>Company Reg No</b>')}
      ${editableCell(esc(ci.company_reg_number || ''))}
      ${editableCell('<b>VAT Number</b>')}
      ${editableCell(esc(ci.vat_number || ''))}
    </tr>
    <tr>
      ${editableCell('<b>Physical Address</b>')}
      ${editableCell(esc(ci.physical_address || ''))}
      ${editableCell('<b>Postal Code</b>')}
      ${editableCell(esc(ci.physical_postal_code || ''))}
    </tr>
    <tr>
      ${editableCell('<b>Postal Address</b>')}
      ${editableCell(esc(ci.postal_address || ''))}
      ${editableCell('<b>Postal Code</b>')}
      ${editableCell(esc(ci.postal_postal_code || ''))}
    </tr>
    <tr>
      ${editableCell('<b>Website</b>')}
      ${editableCell(esc(ci.website || ''))}
      ${editableCell('<b>Industry</b>')}
      ${editableCell(esc(ci.industry_expertise || ''))}
    </tr>
    <tr>
      ${editableCell('<b>Campaign Period</b>')}
      ${editableCell(esc(campaignRange))}
      ${editableCell('')}
      ${editableCell('')}
    </tr>
  </table>
</div>`);

  // ─── Contact Details Table ───
  parts.push(`
<div class="bf-section-title">Contact Details</div>
<div class="contact-table-wrapper">
  <table class="contact-table">
    <tr>
      ${editableCell('<b>Contact Type</b>')}
      ${editableCell('<b>Name</b>')}
      ${editableCell('<b>Email</b>')}
      ${editableCell('<b>Cell</b>')}
      ${editableCell('<b>Tel</b>')}
    </tr>
    <tr>
      ${editableCell('Primary Contact')}
      ${editableCell(esc(pc.name || ''))}
      ${editableCell(esc(pc.email || ''))}
      ${editableCell(esc(pc.cell || ''))}
      ${editableCell(esc(pc.tel || ''))}
    </tr>
    <tr>
      ${editableCell('Material Contact')}
      ${editableCell(esc(mc.name || ''))}
      ${editableCell(esc(mc.email || ''))}
      ${editableCell(esc(mc.cell || ''))}
      ${editableCell(esc(mc.tel || ''))}
    </tr>
    <tr>
      ${editableCell('Accounts Contact')}
      ${editableCell(esc(ac.name || ''))}
      ${editableCell(esc(ac.email || ''))}
      ${editableCell(esc(ac.cell || ''))}
      ${editableCell(esc(ac.tel || ''))}
    </tr>
  </table>
</div>`);

  // ─── Deliverables Table (columns: Deliverables, Price, Discount, Subtotal) ───
  // Financial data is now merged into deliverable rows by format-deliverables.js,
  // so no separate financial rows are needed here.

  // Helper to strip currency prefix from values that already contain it (e.g. "R10000" → "10000")
  function stripCurrency(val) {
    if (!val) return '';
    let s = String(val).trim();
    if (s.startsWith(currency)) s = s.slice(currency.length).trim();
    return s;
  }

  parts.push(`
<div class="bf-section-title">Deliverables</div>
<div class="booking-table-wrapper">
  <table class="booking-table">
    <tr>
      ${editableCell('<b>Deliverables</b>')}
      ${editableCell('<b>Price</b>')}
      ${editableCell('<b>Discount</b>')}
      ${editableCell('<b>Subtotal</b>')}
    </tr>
    ${deliverableRows}
  </table>
</div>`);

  // ─── Financial Summary + Terms Footer ───
  const subtotal = fin.subtotal || '';
  const tax = fin.tax || '';
  const total = fin.total || '';

  parts.push(`
<div class="footer-section">
  <div class="footer-left">
    <div class="editable" contenteditable="true">
      <b>Terms & Conditions</b><br/>
      All prices exclude VAT unless otherwise stated.<br/>
      Payment terms: 30 days from date of invoice.<br/>
      This booking form is valid for 30 days from date of issue.
    </div>
  </div>
  <div class="footer-right">
    <table style="width:100%;border-collapse:collapse;background:transparent;border:none;">
      <tr>
        <td style="padding:6px 0;font-weight:600;border:none;"><div class="editable" contenteditable="true"><b>Subtotal</b></div></td>
        <td style="padding:6px 0;text-align:right;border:none;"><div class="editable" contenteditable="true">${subtotal ? esc(currency) + ' ' + esc(stripCurrency(subtotal)) : ''}</div></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:600;border:none;"><div class="editable" contenteditable="true"><b>VAT (15%)</b></div></td>
        <td style="padding:6px 0;text-align:right;border:none;"><div class="editable" contenteditable="true">${tax ? esc(currency) + ' ' + esc(stripCurrency(tax)) : ''}</div></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:1.1em;border:none;"><div class="editable" contenteditable="true"><b>Total</b></div></td>
        <td style="padding:6px 0;text-align:right;font-weight:700;font-size:1.1em;border:none;"><div class="editable" contenteditable="true">${total ? esc(currency) + ' ' + esc(stripCurrency(total)) : ''}</div></td>
      </tr>
    </table>
  </div>
</div>`);

  // ─── Sign-off Section (representative only, no client signature row) ───
  parts.push(`
<div class="booking-table-wrapper" style="margin-top: 28px;">
  <table class="company-table">
    <tr>
      ${editableCell('<b>Representative</b>')}
      ${editableCell(esc(signOff.representative || ''))}
      ${editableCell('<b>Date</b>')}
      ${editableCell(esc(signOff.date || ''))}
    </tr>
  </table>
</div>`);

  return parts.join('\n');
}

module.exports = { buildBookingFormSnippet };
