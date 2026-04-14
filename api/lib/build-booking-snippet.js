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

function buildBookingFormSnippet(formData, form, deliverableRows, opts) {
  var options = opts || {};
  var isEsignCtx = !!options.includeHeader;
  var tdStyle = isEsignCtx ? ' style="padding:8px 12px;font-size:12px;vertical-align:top;line-height:1.35;border-bottom:1px solid #e5e7eb;color:#222;"' : '';

  function editableCell(content) {
    return '<td' + tdStyle + '><div class="editable" contenteditable="true">' + (content || '') + '</div></td>';
  }
  const ci = formData.client_information || {};
  const fin = formData.financial_totals || {};
  const signOff = formData.sign_off || {};
  const currency = formData.financial_currency || 'R';

  const companyName = ci.company_name || form.clientName || '';
  const tradingName = ci.trading_name || form.tradingName || '';

  // Editor: minimal overrides (editor base.html has its own comprehensive styles)
  // E-sign: full standalone styles since the e-sign app has no booking form CSS
  var styleOverrides;
  // Inline style strings for e-sign (DOMPurify strips <style> tags)
  var isEsign = !!options.includeHeader;
  var S = {
    sectionTitle: isEsign ? ' style="font-size:12px;font-weight:700;text-transform:uppercase;color:#D72626;margin:18px 0 6px;letter-spacing:0.3px;font-family:Arial,sans-serif;text-align:left;"' : '',
    tableWrap: isEsign ? ' style="border:1px solid #d0d0d0;border-radius:8px;overflow:hidden;margin-bottom:18px;"' : '',
    table: isEsign ? ' style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;color:#222;"' : '',
    td: isEsign ? ' style="padding:8px 12px;font-size:12px;vertical-align:top;line-height:1.35;border-bottom:1px solid #e5e7eb;color:#222;"' : '',
    tdLabel: isEsign ? ' style="padding:8px 12px;font-size:12px;font-weight:600;color:#374151;vertical-align:top;line-height:1.35;border-bottom:1px solid #e5e7eb;"' : '',
    tdHeader: isEsign ? ' style="padding:8px 12px;font-size:12px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:2px solid #d0d0d0;"' : '',
    footer: isEsign ? ' style="display:flex;justify-content:space-between;gap:2rem;align-items:flex-start;margin-top:22px;padding-top:14px;border-top:1px solid #e0e0e0;"' : '',
    footerLeft: isEsign ? ' style="flex:1;font-size:11px;line-height:1.6;color:#555;font-family:Arial,sans-serif;"' : '',
    footerRight: isEsign ? ' style="flex:0 0 220px;"' : '',
  };

  if (isEsign) {
    styleOverrides = '';
  } else {
    styleOverrides = '<style>' +
      '.admin-btn, #admin-notion-btn { display: none !important; }' +
      '.banner { background: #16a34a !important; }' +
      '</style>';
  }

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

  // ─── Header: Logo + Address + Legal Strip (only for e-sign, editor has its own) ───
  if (options.includeHeader) {
  parts.push(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #d1d5db;">
  <div><img src="https://checklist.proagrihub.com/ProAgriMedia-CheckList.png" alt="ProAgri Media" style="height:65px;object-fit:contain;"></div>
  <div style="text-align:right;font-size:11px;color:#D72626;font-weight:600;line-height:1.5;">
    PO Box 72707, Lynnwood Ridge, 0040<br>
    33 Oakwood Close, Silverwoods Country Estate<br>
    Tel: 084 088 0123 | Fax: 086 458 7812
  </div>
</div>
<div style="text-align:center;font-size:11px;font-weight:600;color:#374151;margin:6px 1rem 20px;">
  Agri Media Africa (Pty) Ltd. | Reg no: 2019/486053/07 | VAT no: 409 0303 266 | Director: Mrs. D Do Nacimento
</div>`);
  } // end includeHeader

  // ─── Company Information Table ───
  parts.push(`
<div class="bf-section-title"${S.sectionTitle}>Company Information</div>
<div class="booking-table-wrapper"${S.tableWrap}>
  <table class="company-table"${S.table}>
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
<div class="bf-section-title"${S.sectionTitle}>Contact Details</div>
<div class="contact-table-wrapper"${S.tableWrap}>
  <table class="contact-table"${S.table}>
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
<div class="bf-section-title"${S.sectionTitle}>Deliverables</div>
<div class="booking-table-wrapper"${S.tableWrap}>
  <table class="booking-table"${S.table}>
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
<div class="footer-section"${S.footer}>
  <div class="footer-left"${S.footerLeft}>
    <div class="editable" contenteditable="true">
      <b>Terms & Conditions</b><br/>
      All prices exclude VAT unless otherwise stated.<br/>
      Payment terms: 30 days from date of invoice.<br/>
      This booking form is valid for 30 days from date of issue.
    </div>
  </div>
  <div class="footer-right"${S.footerRight}>
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
<div class="booking-table-wrapper"${isEsign ? ' style="border:1px solid #d0d0d0;border-radius:8px;overflow:hidden;margin-top:28px;margin-bottom:18px;"' : ' style="margin-top: 28px;"'}>
  <table class="company-table"${S.table}>
    <tr>
      ${editableCell('<b>Representative</b>')}
      ${editableCell(esc(signOff.representative || ''))}
      ${editableCell('<b>Date</b>')}
      ${editableCell(esc(signOff.date || ''))}
    </tr>
  </table>
</div>`);

  // For editor pages: inject script that overrides "Send to ProAgri" to call
  // CRM send-to-esign directly and redirect to the e-sign page
  if (!options.includeHeader) {
    const formId = form.id || '';
    parts.push('<script>' +
      'window.addEventListener("load",function(){' +
      'setTimeout(function(){' +
      'var btn=document.getElementById("send-booking-to-n8n");' +
      'if(!btn)return;' +
      'var clone=btn.cloneNode(true);' +
      'btn.parentNode.replaceChild(clone,btn);' +
      'clone.addEventListener("click",async function(e){' +
      'e.preventDefault();e.stopPropagation();' +
      'clone.disabled=true;clone.textContent="Generating e-sign...";clone.style.opacity="0.7";' +
      'try{' +
      'var res=await fetch("https://agri360.proagrihub.com/api/booking-forms/' + formId + '/send-to-esign",{method:"POST",headers:{"Content-Type":"application/json"}});' +
      'var data=await res.json();' +
      'if(data.url){window.location.href=data.url;return;}' +
      'document.getElementById("send-status").textContent="Done but no e-sign URL returned.";' +
      '}catch(e){document.getElementById("send-status").textContent="Error: "+e.message;}' +
      'finally{clone.disabled=false;clone.textContent="Send booking form to ProAgri";clone.style.opacity="";}' +
      '});' +
      '},500);' +
      '});' +
      '</script>');
  }

  return parts.join('\n');
}

module.exports = { buildBookingFormSnippet };
