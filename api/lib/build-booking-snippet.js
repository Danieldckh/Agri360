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

  const parts = [];

  // ─── Company Information Table ───
  parts.push(`
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
  parts.push(`
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
        <td style="padding:6px 0;text-align:right;border:none;"><div class="editable" contenteditable="true">${subtotal ? esc(currency) + ' ' + esc(subtotal) : ''}</div></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:600;border:none;"><div class="editable" contenteditable="true"><b>VAT (15%)</b></div></td>
        <td style="padding:6px 0;text-align:right;border:none;"><div class="editable" contenteditable="true">${tax ? esc(currency) + ' ' + esc(tax) : ''}</div></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-weight:700;font-size:1.1em;border:none;"><div class="editable" contenteditable="true"><b>Total</b></div></td>
        <td style="padding:6px 0;text-align:right;font-weight:700;font-size:1.1em;border:none;"><div class="editable" contenteditable="true">${total ? esc(currency) + ' ' + esc(total) : ''}</div></td>
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
