// Maps human-readable country names (as stored in metadata.countries) to ISO 3166-1 alpha-2 codes
const COUNTRY_CODES = {
  'South Africa': 'ZA',
  'Nigeria': 'NG',
  'Kenya': 'KE',
  'Ghana': 'GH',
  'Zimbabwe': 'ZW',
  'Zambia': 'ZM',
  'Tanzania': 'TZ',
  'Uganda': 'UG',
  'Botswana': 'BW',
  'Namibia': 'NA',
  'Mozambique': 'MZ',
  'Ethiopia': 'ET',
  'Rwanda': 'RW',
  'Malawi': 'MW',
  'Senegal': 'SN',
  'Ivory Coast': 'CI',
  "Côte d'Ivoire": 'CI',
  'United States': 'US',
  'United Kingdom': 'GB',
  'Australia': 'AU',
  'Canada': 'CA',
  'Germany': 'DE',
  'France': 'FR',
  'Netherlands': 'NL',
};

function toIsoAlpha2(countryName) {
  if (!countryName) return null;
  return COUNTRY_CODES[countryName] || null;
}

module.exports = { COUNTRY_CODES, toIsoAlpha2 };
