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

  function editableCell(content, cls) {
    var divCls = 'editable' + (cls ? ' ' + cls : '');
    var tdCls = cls ? ' class="' + cls + '-cell"' : '';
    return '<td' + tdCls + tdStyle + '><div class="' + divCls + '" contenteditable="true">' + (content || '') + '</div></td>';
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
    sectionTitle: isEsign ? ' style="font-size:12px;font-weight:900;text-transform:uppercase;color:black;margin:18px 0 6px;padding:0 0 0 10px;letter-spacing:0.3px;font-family:Arial,sans-serif;text-align:left;"' : '',
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
<div class="bf-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;font-family:Arial,sans-serif;">
  <div class="bf-logo-wrap"><img class="bf-logo" src="https://checklist.proagrihub.com/ProAgriMedia-CheckList.png" alt="ProAgri Media" style="height:65px;object-fit:contain;"></div>
  <div class="bf-address-block" style="text-align:right;font-size:11px;color:#D72626;font-weight:600;line-height:1.5;">
    PO Box 72707, Lynnwood Ridge, 0040<br>
    33 Oakwood Close, Silverwoods Country Estate<br>
    Tel: 084 088 0123 | Fax: 086 458 7812
  </div>
</div>
<div class="bf-legal-strip" style="border-top:1px solid #d0d0d0;margin:8px 0 0;padding-top:6px;text-align:center;font-size:11px;font-weight:600;color:#374151;font-family:Arial,sans-serif;">
  Agri Media Africa (Pty) Ltd. | Reg no: 2019/486053/07 | VAT no: 409 0303 266 | Director: Mrs. D Do Nacimento
</div>
<div class="bf-header-spacer" style="margin-bottom:16px;"></div>`);
  } // end includeHeader

  // ─── Company Information Table ───
  parts.push(`
<div class="bf-section-title bf-section-company"${S.sectionTitle}>Company Information</div>
<div class="booking-table-wrapper bf-company-wrap"${S.tableWrap}>
  <table class="company-table bf-company-table"${S.table}>
    <tr class="bf-row bf-row-company-name">
      ${editableCell('<b>Full Company Name</b>', 'bf-label bf-label-company-name')}
      ${editableCell(esc(companyName), 'bf-value bf-value-company-name')}
      ${editableCell('<b>Trading Name</b>', 'bf-label bf-label-trading')}
      ${editableCell(esc(tradingName), 'bf-value bf-value-trading')}
    </tr>
    <tr class="bf-row bf-row-reg">
      ${editableCell('<b>Company Reg No</b>', 'bf-label bf-label-reg')}
      ${editableCell(esc(ci.company_reg_number || ''), 'bf-value bf-value-reg')}
      ${editableCell('<b>VAT Number</b>', 'bf-label bf-label-vat')}
      ${editableCell(esc(ci.vat_number || ''), 'bf-value bf-value-vat')}
    </tr>
    <tr class="bf-row bf-row-physical">
      ${editableCell('<b>Physical Address</b>', 'bf-label bf-label-physical-address')}
      ${editableCell(esc(ci.physical_address || ''), 'bf-value bf-value-physical-address')}
      ${editableCell('<b>Postal Code</b>', 'bf-label bf-label-physical-code')}
      ${editableCell(esc(ci.physical_postal_code || ''), 'bf-value bf-value-physical-code')}
    </tr>
    <tr class="bf-row bf-row-postal">
      ${editableCell('<b>Postal Address</b>', 'bf-label bf-label-postal-address')}
      ${editableCell(esc(ci.postal_address || ''), 'bf-value bf-value-postal-address')}
      ${editableCell('<b>Postal Code</b>', 'bf-label bf-label-postal-code')}
      ${editableCell(esc(ci.postal_postal_code || ''), 'bf-value bf-value-postal-code')}
    </tr>
    <tr class="bf-row bf-row-web-industry">
      ${editableCell('<b>Website</b>', 'bf-label bf-label-website')}
      ${editableCell(esc(ci.website || ''), 'bf-value bf-value-website')}
      ${editableCell('<b>Industry</b>', 'bf-label bf-label-industry')}
      ${editableCell(esc(ci.industry_expertise || ''), 'bf-value bf-value-industry')}
    </tr>
    <tr class="bf-row bf-row-campaign">
      ${editableCell('<b>Campaign Period</b>', 'bf-label bf-label-campaign')}
      ${editableCell(esc(campaignRange), 'bf-value bf-value-campaign')}
      ${editableCell('', 'bf-label bf-label-campaign-filler')}
      ${editableCell('', 'bf-value bf-value-campaign-filler')}
    </tr>
  </table>
</div>`);

  // ─── Contact Details Table ───
  parts.push(`
<div class="bf-section-title bf-section-contact"${S.sectionTitle}>Contact Details</div>
<div class="contact-table-wrapper bf-contact-wrap"${S.tableWrap}>
  <table class="contact-table bf-contact-table"${S.table}>
    <tr class="bf-row bf-row-contact-header">
      ${editableCell('<b>Contact Type</b>', 'bf-label bf-contact-type')}
      ${editableCell('<b>Name</b>',          'bf-label bf-contact-name')}
      ${editableCell('<b>Email</b>',         'bf-label bf-contact-email')}
      ${editableCell('<b>Cell</b>',          'bf-label bf-contact-cell')}
      ${editableCell('<b>Tel</b>',           'bf-label bf-contact-tel')}
    </tr>
    <tr class="bf-row bf-row-primary-contact">
      ${editableCell('Primary Contact',     'bf-value bf-contact-type bf-contact-primary-type')}
      ${editableCell(esc(pc.name || ''),    'bf-value bf-contact-name bf-contact-primary-name')}
      ${editableCell(esc(pc.email || ''),   'bf-value bf-contact-email bf-contact-primary-email')}
      ${editableCell(esc(pc.cell || ''),    'bf-value bf-contact-cell bf-contact-primary-cell')}
      ${editableCell(esc(pc.tel || ''),     'bf-value bf-contact-tel bf-contact-primary-tel')}
    </tr>
    <tr class="bf-row bf-row-material-contact">
      ${editableCell('Material Contact',    'bf-value bf-contact-type bf-contact-material-type')}
      ${editableCell(esc(mc.name || ''),    'bf-value bf-contact-name bf-contact-material-name')}
      ${editableCell(esc(mc.email || ''),   'bf-value bf-contact-email bf-contact-material-email')}
      ${editableCell(esc(mc.cell || ''),    'bf-value bf-contact-cell bf-contact-material-cell')}
      ${editableCell(esc(mc.tel || ''),     'bf-value bf-contact-tel bf-contact-material-tel')}
    </tr>
    <tr class="bf-row bf-row-accounts-contact">
      ${editableCell('Accounts Contact',    'bf-value bf-contact-type bf-contact-accounts-type')}
      ${editableCell(esc(ac.name || ''),    'bf-value bf-contact-name bf-contact-accounts-name')}
      ${editableCell(esc(ac.email || ''),   'bf-value bf-contact-email bf-contact-accounts-email')}
      ${editableCell(esc(ac.cell || ''),    'bf-value bf-contact-cell bf-contact-accounts-cell')}
      ${editableCell(esc(ac.tel || ''),     'bf-value bf-contact-tel bf-contact-accounts-tel')}
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
<div class="bf-section-title bf-section-deliverables"${S.sectionTitle}>Deliverables</div>
<div class="booking-table-wrapper bf-deliverables-wrap"${S.tableWrap}>
  <table class="booking-table bf-deliverables-table"${S.table}>
    <tr class="bf-row bf-row-deliverables-header">
      ${editableCell('<b>Deliverables</b>', 'bf-label bf-del-label')}
      ${editableCell('<b>Price</b>',        'bf-label bf-del-price')}
      ${editableCell('<b>Discount</b>',     'bf-label bf-del-discount')}
      ${editableCell('<b>Subtotal</b>',     'bf-label bf-del-subtotal')}
    </tr>
    ${deliverableRows}
  </table>
</div>`);

  // ─── Financial Summary + Terms Footer ───
  const subtotal = fin.subtotal || '';
  const tax = fin.tax || '';
  const total = fin.total || '';

  var tcCellStyle = isEsign ? ' style="padding:6px 0;border:none;color:#222;text-align:left;"' : ' style="padding:6px 0;border:none;"';
  var tcValueStyle = isEsign ? ' style="padding:6px 0;text-align:right;border:none;color:#222;"' : ' style="padding:6px 0;text-align:right;border:none;"';
  var tcBoldStyle = isEsign ? ' style="padding:6px 0;font-weight:700;font-size:1.1em;border:none;color:#222;"' : ' style="padding:6px 0;font-weight:700;font-size:1.1em;border:none;"';
  var tcBoldValStyle = isEsign ? ' style="padding:6px 0;text-align:right;font-weight:700;font-size:1.1em;border:none;color:#222;"' : ' style="padding:6px 0;text-align:right;font-weight:700;font-size:1.1em;border:none;"';
  var termsStyle = isEsign ? ' style="text-align:left;color:#222;font-size:11px;line-height:1.6;"' : '';

  parts.push(`
<div class="footer-section bf-footer"${S.footer}>
  <div class="footer-left bf-footer-left bf-terms-wrap"${S.footerLeft}>
    <div class="editable bf-terms" contenteditable="true"${termsStyle}>
      <b>Terms & Conditions</b><br/>
      All prices exclude VAT unless otherwise stated.<br/>
      Payment terms: 30 days from date of invoice.<br/>
      This booking form is valid for 30 days from date of issue.
    </div>
  </div>
  <div class="footer-right bf-footer-right bf-totals-wrap"${S.footerRight}>
    <table class="bf-totals-table" style="width:100%;border-collapse:collapse;background:transparent;border:none;">
      <tr class="bf-totals-row bf-totals-subtotal-row">
        <td class="bf-totals-label-cell bf-totals-subtotal-label"${tcCellStyle}><div class="editable bf-totals-label bf-totals-subtotal-label-text" contenteditable="true"><b>Subtotal</b></div></td>
        <td class="bf-totals-value-cell bf-totals-subtotal-value"${tcValueStyle}><div class="editable bf-totals-value bf-totals-subtotal-value-text" contenteditable="true">${subtotal ? esc(currency) + ' ' + esc(stripCurrency(subtotal)) : ''}</div></td>
      </tr>
      <tr class="bf-totals-row bf-totals-vat-row">
        <td class="bf-totals-label-cell bf-totals-vat-label"${tcCellStyle}><div class="editable bf-totals-label bf-totals-vat-label-text" contenteditable="true"><b>VAT (15%)</b></div></td>
        <td class="bf-totals-value-cell bf-totals-vat-value"${tcValueStyle}><div class="editable bf-totals-value bf-totals-vat-value-text" contenteditable="true">${tax ? esc(currency) + ' ' + esc(stripCurrency(tax)) : ''}</div></td>
      </tr>
      <tr class="bf-totals-row bf-totals-total-row">
        <td class="bf-totals-label-cell bf-totals-total-label"${tcBoldStyle}><div class="editable bf-totals-label bf-totals-total bf-totals-total-label-text" contenteditable="true"><b>Total</b></div></td>
        <td class="bf-totals-value-cell bf-totals-total-value"${tcBoldValStyle}><div class="editable bf-totals-value bf-totals-total bf-totals-total-value-text" contenteditable="true">${total ? esc(currency) + ' ' + esc(stripCurrency(total)) : ''}</div></td>
      </tr>
    </table>
  </div>
</div>`);

  // ─── Sign-off Section (only for editor — e-sign has its own signature UI) ───
  if (!isEsign) {
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
  }

  // For e-sign pages: inject script that re-enables editing on Company Info
  // and Contact Details tables after the e-sign app disables all contenteditable
  if (options.includeHeader) {
    parts.push('<script>' +
      'window.addEventListener("load",function(){' +
      'setTimeout(function(){' +
      'var tables=document.querySelectorAll(".company-table .editable, .contact-table .editable");' +
      'tables.forEach(function(el){' +
      'el.setAttribute("contenteditable","true");' +
      'el.style.cursor="text";' +
      'el.style.outline="none";' +
      'el.addEventListener("focus",function(){this.style.background="#e7f1ff";this.style.padding="2px 4px";this.style.borderRadius="3px";});' +
      'el.addEventListener("blur",function(){this.style.background="transparent";this.style.padding="0";});' +
      '});' +
      '},800);' +
      '});' +
      '</script>');
  }

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
