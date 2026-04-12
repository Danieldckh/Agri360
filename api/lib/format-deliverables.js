// Wraps the n8n Code-node format-deliverables logic as a CommonJS module.
// Usage:  const { formatDeliverables } = require('./lib/format-deliverables');
//         const html = formatDeliverables(formData);
//
// The formData object is the checklist payload stored in booking_forms.form_data.
// Returns the HTML string (table rows) ready for POST /create on the editor service.

function formatDeliverables(body) {
  if (!body || typeof body !== 'object') return '';

  const clientInfo = body.client_information || {};
  const companyName = clientInfo.company_name || "";
  const campaignStart = clientInfo.campaign_start;
  const campaignEnd = clientInfo.campaign_end;

  const smmArray = body.social_media_management || [];
  const agriArray = body.agri4all || [];
  const onlineArray = body.online_articles || [];
  const magazineArray = body.magazine || [];
  const videoArray = body.video || [];
  const websiteArray = body.website || [];
  const bannerArray = body.banners || [];

  let googleAdsData = body.google_ads || null;
  if (!googleAdsData) {
    for (const smm of smmArray) {
      if (smm.google_ads && smm.google_ads.enabled) {
        googleAdsData = {
          enabled: true,
          initial_text: smm.google_ads.initial_setup_text || smm.google_ads.initial_text || "",
          monthly_text: smm.google_ads.monthly_ongoing_text || smm.google_ads.monthly_text || ""
        };
        break;
      }
    }
  }

  const MONTH_ORDER = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  function toLabel(y, m) { return `${MONTH_ORDER[m]} ${y}`; }

  function normalizeLabel(label) {
    if (!label) return "";
    return String(label).replace(/,/g, "").trim();
  }

  function buildMonthRange(startYM, endYM) {
    if (!startYM || !endYM) return [];
    const [sy, sm] = startYM.split("-").map(Number);
    const [ey, em] = endYM.split("-").map(Number);
    if (!sy || !sm || !ey || !em) return [];
    const out = [];
    let y = sy, m = sm - 1;
    while (y < ey || (y === ey && m <= em - 1)) {
      out.push(toLabel(y, m));
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  const b = v => `<b>${escapeHtml(v)}</b>`;
  const bu = v => `<b><u>${escapeHtml(v)}</u></b>`;
  const br = () => `<br/>`;

  function formatMonthYearRange(startYM, endYM) {
    if (!startYM || !endYM) return "";
    const [sy, sm] = startYM.split("-").map(Number);
    const [ey, em] = endYM.split("-").map(Number);
    if (!sy || !sm || !ey || !em) return "";
    return `${MONTH_ORDER[sm-1]} ${sy} - ${MONTH_ORDER[em-1]} ${ey}`;
  }

  function indexByMonthSingle(arr, mapFn) {
    const out = {};
    for (const e of arr) {
      const norm = normalizeLabel(e.month_label || e.months_display);
      if (!norm) continue;
      out[norm] = mapFn(e);
    }
    return out;
  }

  function n(v) {
    const x = Number(String(v ?? "").trim());
    return Number.isFinite(x) ? x : 0;
  }

  function mergeStates(target = {}, src = {}) {
    const out = { ...(target || {}) };
    for (const k of Object.keys(src || {})) {
      const a = out[k]; const bv = src[k];
      const na = n(a); const nb = n(bv);
      if ((String(a ?? "").trim() !== "" && Number.isFinite(na)) || (String(bv ?? "").trim() !== "" && Number.isFinite(nb))) {
        out[k] = na + nb; continue;
      }
      if (out[k] == null || out[k] === "") out[k] = bv;
    }
    return out;
  }

  // --- SMM indexing ---
  let smm = { recurring: false, data: {} };
  const smmFirstLabel = normalizeLabel(smmArray[0]?.month_label || "");
  const smmIsAllMonths = smmFirstLabel.toLowerCase() === "all months" || smmFirstLabel === "ALL";
  if (smmArray.length && smmIsAllMonths) { smm.recurring = true; smm.data = smmArray[0]; }
  else { smm.data = indexByMonthSingle(smmArray, e => ({ posts: e.monthly_posts || 0, content_calendar: !!e.content_calendar, own_page: e.own_page || {} })); }

  // --- Online indexing ---
  let online = { recurring: false, data: {} };
  const onlineFirstLabel = normalizeLabel(onlineArray[0]?.month_label || "");
  const onlineIsAllMonths = onlineFirstLabel.toLowerCase() === "all months" || onlineFirstLabel === "ALL";
  if (onlineArray.length && onlineIsAllMonths) { online.recurring = true; online.data = onlineArray[0]; }
  else { online.data = indexByMonthSingle(onlineArray, e => ({ platforms: e.platforms || [], amount: Number(e.amount || 0), curated_amount: Number(e.curated_amount || 0) })); }

  // --- Video indexing ---
  const videoByMonth = {}; const recurringVideos = [];
  for (const e of videoArray) {
    const norm = normalizeLabel(e.month_label || e.months_display); if (!norm) continue;
    const v = { type: e.video_type || "", typeOther: e.video_type_other || "", duration: e.video_duration || "", desc: e.description || "", photographerIncluded: !!(e.photographer_included ?? e.video_photographer_included) };
    if (norm.toLowerCase() === "all months" || norm === "ALL") recurringVideos.push(v);
    else { if (!videoByMonth[norm]) videoByMonth[norm] = []; videoByMonth[norm].push(v); }
  }

  // --- Website indexing ---
  const websiteByMonth = {}; const recurringWebsites = [];
  for (const e of websiteArray) {
    const norm = normalizeLabel(e.month_label || e.months_display); if (!norm) continue;
    const w = { type: e.website_type || "", pages: e.number_of_pages || e.pages || "" };
    if (norm.toLowerCase() === "all months" || norm === "ALL") recurringWebsites.push(w);
    else { if (!websiteByMonth[norm]) websiteByMonth[norm] = []; websiteByMonth[norm].push(w); }
  }

  // --- Magazine indexing ---
  const magazine = {}; const recurringMagazines = [];
  function isAllMonthsLabel(label) {
    if (!label) return false;
    const lower = String(label).toLowerCase().trim();
    if (lower === "all months" || lower === "all" || label === "ALL") return true;
    if (lower.includes(",") && lower.split(",").length > 3) return true;
    return false;
  }
  for (const e of magazineArray) {
    const norm = normalizeLabel(e.month_label || e.months_display); if (!norm) continue;
    const magEntry = { mag: e.mag || e.magazine, page: e.page_size || "", type: e.type || "", line_item: e.line_item || "" };
    if (isAllMonthsLabel(e.month_label) || isAllMonthsLabel(e.months_display)) recurringMagazines.push(magEntry);
    else { if (!magazine[norm]) magazine[norm] = []; magazine[norm].push(magEntry); }
  }

  // --- Agri4All indexing ---
  const agriByMonth = {}; const agriRecurring = [];
  for (const e of agriArray) {
    const norm = normalizeLabel(e.month_label || e.months_display); if (!norm) continue;
    const entry = { country: (e.country || "").trim(), state: e.state || {} };
    if (norm.toLowerCase() === "all months" || norm === "ALL") agriRecurring.push(entry);
    else { if (!agriByMonth[norm]) agriByMonth[norm] = []; agriByMonth[norm].push(entry); }
  }

  // --- Banners indexing ---
  const bannerByMonth = {}; const recurringBanners = [];
  for (const e of bannerArray || []) {
    const norm = normalizeLabel(e.month_label || e.months_display); if (!norm) continue;
    const entries = e.entries || [];
    if (norm.toLowerCase() === "all months" || norm === "ALL") recurringBanners.push(...entries);
    else bannerByMonth[norm] = entries;
  }

  // --- Formatters ---
  function formatMagazine(arr) {
    const out = [];
    for (const m of arr) {
      if (m.line_item) { out.push(`${escapeHtml(m.line_item).replace(/Essay/gi,"SA")}${br()}`); continue; }
      if (!m.page && !m.type) out.push(`? Magazine missing details: ${escapeHtml(m.mag || "")}${br()}`);
      else out.push(`1 x ${escapeHtml(m.page)} ${escapeHtml(m.type)} ${escapeHtml(m.mag || "")}${br()}`);
    }
    return out;
  }

  function formatOnline(o, banners = []) {
    const out = [];
    if (o?.platforms?.length) o.platforms.forEach(p => out.push(`${Number(o.amount || 0)} x online article (${escapeHtml(p)})${br()}`));
    if (Number(o?.curated_amount || 0) > 0) out.push(`${Number(o.curated_amount)} x online curated campaigns${br()}`);
    if (banners?.length) banners.forEach(bv => out.push(`${escapeHtml(bv?.impressions ?? "")} x Banner impressions on ${escapeHtml(bv?.platform ?? "")}${br()}`));
    return out;
  }

  function formatVideoList(list) {
    const out = [];
    for (const v of list) {
      const isOther = (v.type || "").toLowerCase() === "other";
      const label = isOther ? (v.typeOther || "Video") : (v.type || "Video");
      const main = v.duration ? `1 x ${escapeHtml(v.duration)} ${escapeHtml(label)}` : `1 x ${escapeHtml(label)}`;
      out.push(`${main}${br()}`);
      if (v.photographerIncluded) out.push(`Photographer Included${br()}`);
      if (v.desc) out.push(`${escapeHtml(v.desc)}${br()}`);
      out.push(br());
    }
    return out;
  }

  function formatWebsiteList(list) {
    const out = [];
    for (const w of list) {
      if (w.type === "Monthly Website Management") out.push(`Management of your website${br()}`);
      else { if (w.pages) out.push(`${escapeHtml(w.pages)} pages${br()}`); out.push(`Website design, build, and launch including responsive layout and basic SEO setup.${br()}`); }
      out.push(br());
    }
    return out;
  }

  function formatGoogleAds(data) {
    if (!data || !data.enabled) return [];
    const out = [];
    out.push(bu("Google Ads - Initial Setup") + br());
    const initialText = data.initial_text || "Initial setup Cost\nKeyword Research and Analysis\nCompetitor Analysis\nCampaign and Ad Group Structuring\nAd Copywriting and Creation\nLanding Page Development\nConversion Tracking Setup\nGoogle Analytics Integration";
    initialText.split('\n').forEach(line => { if (line.trim()) out.push(`${escapeHtml(line.trim())}${br()}`); });
    out.push(br());
    out.push(bu("Google Ads - Monthly Ongoing") + br());
    const monthlyText = data.monthly_text || "Ongoing Google Ads Management cost\nCampaign Management\nA/B Testing and Optimization\nReporting and Analysis\nAdvertising budget\nClient responsible for payment of ad spend separately";
    monthlyText.split('\n').forEach(line => { if (line.trim()) out.push(`${escapeHtml(line.trim())}${br()}`); });
    out.push(br());
    return out;
  }

  function formatSMM(o) {
    if (!o) return [];
    const out = [];
    out.push(`Management and reporting of ${escapeHtml(companyName)}'s social media platforms.${br()}`);
    const hasContentCalendar = !!(o.content_calendar || o.contentCalendar);
    if (hasContentCalendar) out.push("We plan, create, and schedule your content in advance, then publish it consistently throughout the month on your behalf. This ensures your channels remain active, aligned, and professionally managed." + br());
    out.push(br());
    const posts = Number(o.posts || o.monthly_posts || 0);
    if (posts) out.push(`${posts} x monthly posts${br()}`);
    const own = o.own_page || {};
    const hasOwnPage = own.facebook_posts || own.facebook_stories || own.facebook_video_posts || own.instagram_posts || own.instagram_stories || own.tiktok_shorts || own.youtube_shorts || own.youtube_video || own.linkedin_article || own.linkedin_campaign || own.twitter_x_posts || n(own.facebook_posts_amount) || n(own.instagram_posts_amount) || n(own.tiktok_amount) || n(own.youtube_shorts_amount) || n(own.youtube_video_amount) || n(own.linkedin_amount) || n(own.twitter_x_posts_amount);
    if (hasOwnPage) {
      out.push(br()); out.push(bu("Own Page Social Media") + br());
      if (n(own.facebook_posts_amount)) out.push(`${n(own.facebook_posts_amount)} x Facebook Posts${br()}`);
      if (n(own.facebook_posts_curated_amount)) out.push(`${n(own.facebook_posts_curated_amount)} x Facebook Posts curated campaigns${br()}`);
      if (n(own.facebook_stories_amount)) out.push(`${n(own.facebook_stories_amount)} x Facebook Stories${br()}`);
      if (n(own.facebook_video_posts_amount)) out.push(`${n(own.facebook_video_posts_amount)} x Facebook Video Posts${br()}`);
      if (n(own.facebook_video_posts_curated_amount)) out.push(`${n(own.facebook_video_posts_curated_amount)} x Facebook Video Posts curated campaigns${br()}`);
      if (n(own.instagram_posts_amount)) out.push(`${n(own.instagram_posts_amount)} x Instagram Posts${br()}`);
      if (n(own.instagram_posts_curated_amount)) out.push(`${n(own.instagram_posts_curated_amount)} x Instagram Posts curated campaigns${br()}`);
      if (n(own.instagram_stories_amount)) out.push(`${n(own.instagram_stories_amount)} x Instagram Stories${br()}`);
      if (n(own.tiktok_amount)) out.push(`${n(own.tiktok_amount)} x TikTok Shorts${br()}`); else if (own.tiktok_shorts) out.push(`TikTok Shorts${br()}`);
      if (n(own.youtube_shorts_amount)) out.push(`${n(own.youtube_shorts_amount)} x YouTube Shorts${br()}`); else if (own.youtube_shorts) out.push(`YouTube Shorts${br()}`);
      if (n(own.youtube_video_amount)) out.push(`${n(own.youtube_video_amount)} x YouTube Video${br()}`); else if (own.youtube_video) out.push(`YouTube Video${br()}`);
      if (own.linkedin_article && own.linkedin_campaign && n(own.linkedin_amount)) out.push(`${n(own.linkedin_amount)} x LinkedIn Article and Campaign${br()}`);
      else { if (own.linkedin_article && n(own.linkedin_amount)) out.push(`${n(own.linkedin_amount)} x LinkedIn Article${br()}`); if (own.linkedin_campaign && n(own.linkedin_amount)) out.push(`${n(own.linkedin_amount)} x LinkedIn Campaign${br()}`); }
      if (n(own.twitter_x_posts_amount)) out.push(`${n(own.twitter_x_posts_amount)} x Twitter/X Posts${br()}`); else if (own.twitter_x_posts) out.push(`Twitter/X Posts${br()}`);
    }
    out.push(br());
    return out;
  }

  function formatAgri4All(entries) {
    const out = [];
    if (!entries?.length) return out;
    const isFbPseudo = c => String(c || "").trim().toLowerCase() === "facebook";
    const general = entries.filter(e => !e.country);
    const countriesRaw = entries.filter(e => e.country);
    let generalState = general[0]?.state || {};
    const fbPseudo = countriesRaw.filter(e => isFbPseudo(e.country));
    if (fbPseudo.length) for (const e of fbPseudo) generalState = mergeStates(generalState, e.state || {});
    const countries = countriesRaw.filter(e => !isFbPseudo(e.country));
    const hasUnlimitedUploads = entries.some(e => !!e?.state?.unlimited_product_uploads);
    out.push(bu("Agri4All") + br() + br());
    if (general.length || fbPseudo.length) {
      const s = generalState || {};
      out.push(b("TIKTOK | INSTAGRAM | LINKEDIN | FACEBOOK") + br());
      out.push(b("STORIES | YOUTUBE") + br());
      if (n(s.instagram_posts_amount)) out.push(`${n(s.instagram_posts_amount)} x Instagram Feed Features${br()}`);
      if (n(s.instagram_stories_amount)) out.push(`${n(s.instagram_stories_amount)} x Instagram stories Features${br()}`);
      if (n(s.facebook_stories_amount)) out.push(`${n(s.facebook_stories_amount)} x Facebook Stories Features${br()}`);
      if (hasUnlimitedUploads) out.push(`Unlimited product uploads to Agri4all.com, full report after campaign.${br()}`);
      if (n(s.tiktok_amount)) out.push(`${n(s.tiktok_amount)} x TikTok Strategic Video Campaigns${br()}`);
      if (n(s.youtube_shorts_amount)) out.push(`${n(s.youtube_shorts_amount)} x YouTube Shorts${br()}`); else if (s.youtube_shorts) out.push(`YouTube Shorts${br()}`);
      if (n(s.youtube_video_amount)) out.push(`${n(s.youtube_video_amount)} x YouTube Videos${br()}`); else if (s.youtube_video) out.push(`YouTube Videos${br()}`);
      if (s.linkedin_article || s.linkedin_company_campaign) out.push(`1 x LinkedIn Article and Company campaign${br()}`);
      out.push(br());
    }
    if (countries.length) {
      out.push(bu("Agri4All") + br() + br());
      const sorted = [...countries].sort((a, bv) => String(a.country).localeCompare(String(bv.country)));
      for (const c of sorted) {
        const s = c.state || {};
        out.push(b(c.country) + br() + br());
        out.push(bu("Facebook") + br());
        if (n(s.facebook_posts_amount)) out.push(`${n(s.facebook_posts_amount)} x Posts${br()}`);
        if (n(s.facebook_stories_amount)) out.push(`${n(s.facebook_stories_amount)} x Facebook Stories${br()}`);
        if (n(s.facebook_posts_curated_amount)) out.push(`${n(s.facebook_posts_curated_amount)} x Managed Strategic Campaigns${br()}`);
        if (n(s.facebook_video_posts_amount)) out.push(`${n(s.facebook_video_posts_amount)} x Video Posts${br()}`);
        if (n(s.facebook_video_posts_curated_amount)) out.push(`${n(s.facebook_video_posts_curated_amount)} x Managed Strategic Campaigns${br()}`);
        out.push(br());
      }
    }
    return out;
  }

  // --- Content checks ---
  function hasSMMMonth(label) { const s = smm.data?.[label]; if (!s) return false; return Number(s.posts) > 0 || !!s.content_calendar; }
  function hasVideoMonth(label) { return Boolean(videoByMonth[label]?.length); }
  function hasWebsiteMonth(label) { return Boolean(websiteByMonth[label]?.length); }
  function hasOnlineMonth(label) {
    if (online.recurring) return false;
    const o = online.data?.[label]; const banners = bannerByMonth[label];
    return Boolean(o && ((o.platforms && o.platforms.length) || Number(o.amount) > 0 || Number(o.curated_amount) > 0)) || Boolean(banners && banners.length);
  }
  function hasMagazineMonth(label) { return Boolean(magazine[label]?.length); }
  function hasAgriMonth(label) { return Boolean(agriByMonth[label]?.length); }
  function hasAnyMonthContent(label) { return hasSMMMonth(label) || hasVideoMonth(label) || hasWebsiteMonth(label) || hasOnlineMonth(label) || hasMagazineMonth(label) || hasAgriMonth(label); }

  // --- Build sections ---
  function buildRecurring() {
    const content = [];
    const rangeLabel = formatMonthYearRange(campaignStart, campaignEnd);
    const hasRecurringOnline = online.recurring || recurringBanners.length > 0;
    const hasGoogleAds = googleAdsData && googleAdsData.enabled;
    const hasAnything = smm.recurring || hasGoogleAds || hasRecurringOnline || recurringVideos.length || recurringWebsites.length || recurringMagazines.length || agriRecurring.length;
    if (!hasAnything) return "";
    content.push(`<h3>${escapeHtml(rangeLabel)}</h3>`);
    if (smm.recurring) { content.push(bu("Social Media Management") + br()); formatSMM({ posts: smm.data.monthly_posts || smm.data.posts || 0, content_calendar: !!smm.data.content_calendar }).forEach(x => content.push(x)); }
    if (hasGoogleAds) formatGoogleAds(googleAdsData).forEach(x => content.push(x));
    if (hasRecurringOnline) { content.push(bu("Online Articles") + br()); formatOnline(online.recurring ? online.data : null, recurringBanners).forEach(x => content.push(x)); content.push(br()); }
    if (recurringVideos.length) { content.push(bu("Video") + br()); formatVideoList(recurringVideos).forEach(x => content.push(x)); }
    if (recurringWebsites.length) { const wh = recurringWebsites[0]?.type === "Monthly Website Management" ? "Website Management" : "Website Design & Development"; content.push(bu(wh) + br()); formatWebsiteList(recurringWebsites).forEach(x => content.push(x)); }
    if (recurringMagazines.length) { content.push(bu("Magazine") + br()); formatMagazine(recurringMagazines).forEach(x => content.push(x)); content.push(br()); }
    if (agriRecurring.length) formatAgri4All(agriRecurring).forEach(x => content.push(x));
    return content.join("");
  }

  function buildMonth(label) {
    const out = [];
    out.push(`<h3>${escapeHtml(label)}</h3>`);
    if (smm.data[label]) { out.push(bu("Social Media Management") + br()); formatSMM(smm.data[label]).forEach(x => out.push(x)); }
    if (hasVideoMonth(label)) { out.push(bu("Video") + br()); formatVideoList(videoByMonth[label]).forEach(x => out.push(x)); }
    if (hasWebsiteMonth(label)) { const wh = websiteByMonth[label][0]?.type === "Monthly Website Management" ? "Website Management" : "Website Design & Development"; out.push(bu(wh) + br()); formatWebsiteList(websiteByMonth[label]).forEach(x => out.push(x)); }
    if (hasOnlineMonth(label)) { out.push(bu("ONLINE") + br()); formatOnline(online.data[label], bannerByMonth[label]).forEach(x => out.push(x)); out.push(br()); }
    if (hasMagazineMonth(label)) { out.push(bu("Magazine") + br()); formatMagazine(magazine[label]).forEach(x => out.push(x)); out.push(br()); }
    if (hasAgriMonth(label)) formatAgri4All(agriByMonth[label]).forEach(x => out.push(x));
    return out.join("");
  }

  function row(html) {
    return `<tr>\n<td><div class="editable" contenteditable="true">${html}</div></td>\n<td><div class="editable" contenteditable="true"></div></td>\n<td><div class="editable" contenteditable="true"></div></td>\n<td><div class="editable" contenteditable="true"></div></td>\n<td><div class="editable" contenteditable="true"></div></td>\n<td><div class="editable" contenteditable="true"></div></td>\n</tr>`;
  }

  // --- Output ---
  const months = buildMonthRange(campaignStart, campaignEnd);
  const rows = [];
  const recurringHTML = buildRecurring();
  if (recurringHTML.trim()) rows.push(row(recurringHTML));
  for (const m of months) {
    if (!hasAnyMonthContent(m)) continue;
    rows.push(row(buildMonth(m)));
  }
  return rows.join("");
}

module.exports = { formatDeliverables };
