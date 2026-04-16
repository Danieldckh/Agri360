// Builds the JSON payload POSTed to the Booking Form E-sign service
// (secure-signature-page) at `POST /api/esign/booking/create`.
//
// The authoritative shape lives in the sister repo at:
//   esign document/src/types/booking-payload.ts
//
// Mirror of that contract (kept here so CRM readers don't need to jump
// repos to see what's being sent):
//
//   interface BookingContact      { name?; email?; cell?; tel?; }
//   interface BookingClientColumns {
//     name?; trading_name?;
//     primary_contact?: BookingContact;
//     material_contact?: BookingContact;
//     accounts_contact?: BookingContact;
//   }
//   interface BookingDeliverableSection {
//     service: string;        // "Social Media Management", "Agri4All", etc.
//     lines: string[];        // human-readable bullet lines
//     price: string;          // numeric string, no currency prefix
//     discount: string;       // numeric string
//     subtotal: string;       // numeric string
//   }
//   interface BookingDeliverableMonth {
//     monthLabel: string;     // e.g. "February 2026"
//     monthsDisplay: string;  // e.g. "February 2026 – May 2026"
//     sections: BookingDeliverableSection[];
//   }
//   interface BookingEsignPayload {
//     slug: string;
//     clientName: string;
//     bookingFormId: number;
//     formData: object;       // the raw booking_forms.form_data JSONB
//     clientColumns: BookingClientColumns;
//     deliverables: BookingDeliverableMonth[];
//     currency: string;       // e.g. "R"
//   }
//
// DO NOT break field names or shapes without updating both repos in lockstep.

const { formatDeliverables } = require('./format-deliverables');

/**
 * Build the structured esign payload for a booking form.
 *
 * @param {object} formData      Raw booking_forms.form_data JSONB (untouched).
 * @param {object} form          The booking_forms row (camelCased), must include
 *                               `id` and `clientName`.
 * @param {object} clientColumns The joined clients row projection:
 *                               { name, trading_name, primary_contact,
 *                                 material_contact, accounts_contact }.
 * @returns {object} BookingEsignPayload
 */
function buildEsignPayload(formData, form, clientColumns) {
  const safeFormData = formData && typeof formData === 'object' ? formData : {};
  const safeForm = form || {};
  const safeClientColumns = clientColumns && typeof clientColumns === 'object' ? clientColumns : {};

  const clientInfo = safeFormData.client_information || {};
  const clientName = clientInfo.company_name || safeForm.clientName || '';

  // Same slug algorithm as the legacy send-to-esign handler.
  const slugBase = (safeForm.clientName || clientName || 'booking')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const slug = `${slugBase}-${safeForm.id}`;

  const deliverables = formatDeliverables(safeFormData, { as: 'json' });
  const currency = safeFormData.financial_currency || 'R';

  return {
    slug,
    clientName,
    bookingFormId: safeForm.id,
    formData: safeFormData,
    // Client-uploaded logo from the editable booking form. Empty string
    // means "use the default ProAgri logo".
    clientLogo: typeof safeFormData.client_logo === 'string' ? safeFormData.client_logo : '',
    clientColumns: {
      name: safeClientColumns.name,
      trading_name: safeClientColumns.trading_name,
      primary_contact: safeClientColumns.primary_contact,
      material_contact: safeClientColumns.material_contact,
      accounts_contact: safeClientColumns.accounts_contact,
    },
    deliverables,
    currency,
  };
}

module.exports = { buildEsignPayload };
