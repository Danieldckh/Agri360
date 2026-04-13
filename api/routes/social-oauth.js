const { Router } = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toCamelCase } = require('../utils');
const config = require('../config');

const router = Router();

// In-memory store for PKCE code verifiers (Twitter requires PKCE)
// Key: state JWT nonce, Value: code_verifier string
const pkceStore = new Map();

// Clean up PKCE entries older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pkceStore) {
    if (val.createdAt < cutoff) pkceStore.delete(key);
  }
}, 60 * 1000);

// ── Helpers ──────────────────────────────────────────────────────

function makeState(platform, clientId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return {
    nonce,
    token: jwt.sign({ platform, clientId: clientId || null, nonce }, config.JWT_SECRET, { expiresIn: '10m' })
  };
}

function verifyState(stateToken) {
  return jwt.verify(stateToken, config.JWT_SECRET);
}

function redirectUri(platform) {
  return `${config.APP_URL}/api/social-oauth/callback/${platform}`;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Renders a small HTML page that notifies the opener window and closes itself
function successPage(platform, accountName) {
  return `<!DOCTYPE html><html><head><title>Connected</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4f0}
.card{text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#2e7d32;margin:0 0 8px}p{color:#666;margin:0}</style></head>
<body><div class="card"><h2>Connected!</h2><p>${platform} account <strong>${accountName || ''}</strong> linked successfully.</p>
<p style="margin-top:16px;color:#999">This window will close automatically&hellip;</p></div>
<script>
if(window.opener){window.opener.postMessage({type:'social-oauth-success',platform:'${platform}'},'*');}
setTimeout(function(){window.close();},2000);
</script></body></html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html><html><head><title>Connection Failed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fdf0f0}
.card{text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#c62828;margin:0 0 8px}p{color:#666;margin:0}</style></head>
<body><div class="card"><h2>Connection Failed</h2><p>${message}</p>
<p style="margin-top:16px"><a href="#" onclick="window.close()">Close this window</a></p></div>
<script>
if(window.opener){window.opener.postMessage({type:'social-oauth-error',message:'${message.replace(/'/g, "\\'")}'},'*');}
</script></body></html>`;
}

async function upsertCredential({ platform, accountName, accountHandle, credentials, clientId, refreshToken, tokenExpiresAt, oauthMetadata, userId }) {
  // Check if a credential already exists for this platform + client
  const existing = await pool.query(
    `SELECT id FROM social_credentials WHERE platform = $1 AND (client_id = $2 OR ($2 IS NULL AND client_id IS NULL))`,
    [platform, clientId || null]
  );

  if (existing.rows.length > 0) {
    // Update existing credential
    await pool.query(
      `UPDATE social_credentials SET
        account_name = $1, account_handle = $2, credentials = $3,
        refresh_token = $4, token_expires_at = $5, oauth_metadata = $6,
        is_active = TRUE, last_verified_at = NOW(), updated_at = NOW()
       WHERE id = $7`,
      [accountName, accountHandle || null, JSON.stringify(credentials),
       refreshToken || null, tokenExpiresAt || null, JSON.stringify(oauthMetadata || {}),
       existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  // Insert new credential
  const result = await pool.query(
    `INSERT INTO social_credentials
      (platform, account_name, account_handle, credentials, client_id, created_by,
       refresh_token, token_expires_at, oauth_metadata, is_active, last_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NOW())
     RETURNING id`,
    [platform, accountName, accountHandle || null, JSON.stringify(credentials),
     clientId || null, userId || null,
     refreshToken || null, tokenExpiresAt || null, JSON.stringify(oauthMetadata || {})]
  );
  return result.rows[0].id;
}


// ── GET /config — return which platforms have credentials configured ──

router.get('/config', requireAuth, (req, res) => {
  const platforms = {
    facebook:  !!(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET),
    instagram: !!(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET), // shared with Facebook
    twitter:   !!(config.TWITTER_CLIENT_ID && config.TWITTER_CLIENT_SECRET),
    linkedin:  !!(config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET),
    youtube:   !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
    tiktok:    !!(config.TIKTOK_CLIENT_KEY && config.TIKTOK_CLIENT_SECRET),
  };
  res.json({ platforms });
});


// ══════════════════════════════════════════════════════════════════
//  FACEBOOK
// ══════════════════════════════════════════════════════════════════

router.get('/init/facebook', requireAuth, (req, res) => {
  if (!config.FACEBOOK_APP_ID || !config.FACEBOOK_APP_SECRET) {
    return res.status(400).json({ error: 'Facebook OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env' });
  }
  const clientId = req.query.clientId || null;
  const { token } = makeState('facebook', clientId);
  const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list';
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${config.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri('facebook'))}&scope=${scopes}&state=${token}&response_type=code`;
  res.json({ url });
});

router.get('/callback/facebook', async (req, res) => {
  try {
    const { code, state, error: fbError } = req.query;
    if (fbError) return res.send(errorPage('Facebook denied access: ' + fbError));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'facebook') return res.send(errorPage('State mismatch'));

    // Exchange code for user access token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${config.FACEBOOK_APP_ID}&client_secret=${config.FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri('facebook'))}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(errorPage('Token exchange failed: ' + (tokenData.error.message || tokenData.error)));

    // Exchange short-lived token for long-lived token
    const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.FACEBOOK_APP_ID}&client_secret=${config.FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;
    const longRes = await fetch(longUrl);
    const longData = await longRes.json();
    const userToken = longData.access_token || tokenData.access_token;

    // Get user's pages
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`);
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.send(errorPage('No Facebook Pages found. You need a Facebook Page to post.'));
    }

    // Use the first page (user can reconnect to pick a different one)
    const page = pagesData.data[0];

    await upsertCredential({
      platform: 'facebook',
      accountName: page.name,
      accountHandle: page.id,
      credentials: { page_id: page.id, access_token: page.access_token },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: null, // Page tokens from long-lived user tokens don't expire
      tokenExpiresAt: null,
      oauthMetadata: { user_token: userToken, pages: pagesData.data.map(p => ({ id: p.id, name: p.name })) }
    });

    res.send(successPage('Facebook', page.name));
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    res.send(errorPage('Internal error during Facebook connection'));
  }
});


// ══════════════════════════════════════════════════════════════════
//  INSTAGRAM (via Facebook Graph API — shares Facebook app)
// ══════════════════════════════════════════════════════════════════

router.get('/init/instagram', requireAuth, (req, res) => {
  if (!config.FACEBOOK_APP_ID || !config.FACEBOOK_APP_SECRET) {
    return res.status(400).json({ error: 'Instagram OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env (Instagram uses Meta Graph API)' });
  }
  const clientId = req.query.clientId || null;
  const { token } = makeState('instagram', clientId);
  const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish';
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${config.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri('instagram'))}&scope=${scopes}&state=${token}&response_type=code`;
  res.json({ url });
});

router.get('/callback/instagram', async (req, res) => {
  try {
    const { code, state, error: fbError } = req.query;
    if (fbError) return res.send(errorPage('Instagram/Facebook denied access: ' + fbError));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'instagram') return res.send(errorPage('State mismatch'));

    // Exchange code for user access token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${config.FACEBOOK_APP_ID}&client_secret=${config.FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri('instagram'))}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(errorPage('Token exchange failed: ' + (tokenData.error.message || tokenData.error)));

    // Long-lived token
    const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.FACEBOOK_APP_ID}&client_secret=${config.FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;
    const longRes = await fetch(longUrl);
    const longData = await longRes.json();
    const userToken = longData.access_token || tokenData.access_token;

    // Get pages with Instagram business account
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account&access_token=${userToken}`);
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.send(errorPage('No Facebook Pages found. Instagram Business accounts require a linked Facebook Page.'));
    }

    // Find a page with an Instagram business account
    const igPage = pagesData.data.find(p => p.instagram_business_account);
    if (!igPage) {
      return res.send(errorPage('No Instagram Business account found linked to your Facebook Pages. Link an Instagram Business account to a Facebook Page first.'));
    }

    const igUserId = igPage.instagram_business_account.id;

    // Get IG account details
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}?fields=username,name,profile_picture_url&access_token=${userToken}`);
    const igData = await igRes.json();

    await upsertCredential({
      platform: 'instagram',
      accountName: igData.name || igData.username || 'Instagram Account',
      accountHandle: igData.username || igUserId,
      credentials: { ig_user_id: igUserId, page_id: igPage.id, access_token: igPage.access_token || userToken },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: null,
      tokenExpiresAt: null,
      oauthMetadata: { user_token: userToken, ig_username: igData.username }
    });

    res.send(successPage('Instagram', igData.username || igData.name));
  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    res.send(errorPage('Internal error during Instagram connection'));
  }
});


// ══════════════════════════════════════════════════════════════════
//  TWITTER / X (OAuth 2.0 with PKCE)
// ══════════════════════════════════════════════════════════════════

router.get('/init/twitter', requireAuth, (req, res) => {
  if (!config.TWITTER_CLIENT_ID || !config.TWITTER_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env' });
  }
  const clientId = req.query.clientId || null;
  const { nonce, token } = makeState('twitter', clientId);

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  pkceStore.set(nonce, { codeVerifier, createdAt: Date.now() });

  const scopes = 'tweet.read tweet.write users.read offline.access';
  const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${config.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri('twitter'))}&scope=${encodeURIComponent(scopes)}&state=${token}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  res.json({ url });
});

router.get('/callback/twitter', async (req, res) => {
  try {
    const { code, state, error: twError } = req.query;
    if (twError) return res.send(errorPage('Twitter denied access: ' + twError));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'twitter') return res.send(errorPage('State mismatch'));

    const pkceEntry = pkceStore.get(payload.nonce);
    if (!pkceEntry) return res.send(errorPage('PKCE session expired. Please try again.'));
    pkceStore.delete(payload.nonce);

    // Exchange code for tokens
    const basicAuth = Buffer.from(`${config.TWITTER_CLIENT_ID}:${config.TWITTER_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: `code=${encodeURIComponent(code)}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri('twitter'))}&code_verifier=${pkceEntry.codeVerifier}`
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(errorPage('Twitter token exchange failed: ' + (tokenData.error_description || tokenData.error)));

    // Get user info
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const user = userData.data || {};

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await upsertCredential({
      platform: 'twitter',
      accountName: user.name || 'Twitter Account',
      accountHandle: user.username ? '@' + user.username : null,
      credentials: { access_token: tokenData.access_token },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: expiresAt,
      oauthMetadata: { user_id: user.id, username: user.username }
    });

    res.send(successPage('Twitter', user.username ? '@' + user.username : user.name));
  } catch (err) {
    console.error('Twitter OAuth callback error:', err);
    res.send(errorPage('Internal error during Twitter connection'));
  }
});


// ══════════════════════════════════════════════════════════════════
//  LINKEDIN
// ══════════════════════════════════════════════════════════════════

router.get('/init/linkedin', requireAuth, (req, res) => {
  if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) {
    return res.status(400).json({ error: 'LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env' });
  }
  const clientId = req.query.clientId || null;
  const { token } = makeState('linkedin', clientId);
  const scopes = 'openid profile w_member_social';
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${config.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri('linkedin'))}&scope=${encodeURIComponent(scopes)}&state=${token}`;
  res.json({ url });
});

router.get('/callback/linkedin', async (req, res) => {
  try {
    const { code, state, error: liError, error_description } = req.query;
    if (liError) return res.send(errorPage('LinkedIn denied access: ' + (error_description || liError)));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'linkedin') return res.send(errorPage('State mismatch'));

    // Exchange code for tokens
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri('linkedin'))}&client_id=${config.LINKEDIN_CLIENT_ID}&client_secret=${config.LINKEDIN_CLIENT_SECRET}`
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(errorPage('LinkedIn token exchange failed: ' + (tokenData.error_description || tokenData.error)));

    // Get user profile via OpenID userinfo
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await upsertCredential({
      platform: 'linkedin',
      accountName: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || 'LinkedIn User',
      accountHandle: profile.sub,
      credentials: { access_token: tokenData.access_token, person_urn: 'urn:li:person:' + profile.sub },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: expiresAt,
      oauthMetadata: { sub: profile.sub, name: profile.name, picture: profile.picture }
    });

    res.send(successPage('LinkedIn', profile.name));
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    res.send(errorPage('Internal error during LinkedIn connection'));
  }
});


// ══════════════════════════════════════════════════════════════════
//  YOUTUBE (Google OAuth 2.0)
// ══════════════════════════════════════════════════════════════════

router.get('/init/youtube', requireAuth, (req, res) => {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ error: 'YouTube/Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' });
  }
  const clientId = req.query.clientId || null;
  const { token } = makeState('youtube', clientId);
  const scopes = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri('youtube'))}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${token}&access_type=offline&prompt=consent`;
  res.json({ url });
});

router.get('/callback/youtube', async (req, res) => {
  try {
    const { code, state, error: gError } = req.query;
    if (gError) return res.send(errorPage('Google denied access: ' + gError));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'youtube') return res.send(errorPage('State mismatch'));

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `code=${encodeURIComponent(code)}&client_id=${config.GOOGLE_CLIENT_ID}&client_secret=${config.GOOGLE_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(redirectUri('youtube'))}&grant_type=authorization_code`
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.send(errorPage('Google token exchange failed: ' + (tokenData.error_description || tokenData.error)));

    // Get YouTube channel info
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const channelData = await channelRes.json();
    const channel = (channelData.items && channelData.items[0]) || {};
    const snippet = channel.snippet || {};

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await upsertCredential({
      platform: 'youtube',
      accountName: snippet.title || 'YouTube Channel',
      accountHandle: snippet.customUrl || channel.id || null,
      credentials: { access_token: tokenData.access_token, channel_id: channel.id },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: expiresAt,
      oauthMetadata: { channel_id: channel.id, title: snippet.title, thumbnail: snippet.thumbnails && snippet.thumbnails.default && snippet.thumbnails.default.url }
    });

    res.send(successPage('YouTube', snippet.title));
  } catch (err) {
    console.error('YouTube OAuth callback error:', err);
    res.send(errorPage('Internal error during YouTube connection'));
  }
});


// ══════════════════════════════════════════════════════════════════
//  TIKTOK
// ══════════════════════════════════════════════════════════════════

router.get('/init/tiktok', requireAuth, (req, res) => {
  if (!config.TIKTOK_CLIENT_KEY || !config.TIKTOK_CLIENT_SECRET) {
    return res.status(400).json({ error: 'TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env' });
  }
  const clientId = req.query.clientId || null;
  const { token } = makeState('tiktok', clientId);
  const scopes = 'user.info.basic,video.publish';
  const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${config.TIKTOK_CLIENT_KEY}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri('tiktok'))}&state=${token}`;
  res.json({ url });
});

router.get('/callback/tiktok', async (req, res) => {
  try {
    const { code, state, error: ttError, error_description } = req.query;
    if (ttError) return res.send(errorPage('TikTok denied access: ' + (error_description || ttError)));
    if (!code || !state) return res.send(errorPage('Missing authorization code'));

    const payload = verifyState(state);
    if (payload.platform !== 'tiktok') return res.send(errorPage('State mismatch'));

    // Exchange code for tokens
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_key=${config.TIKTOK_CLIENT_KEY}&client_secret=${config.TIKTOK_CLIENT_SECRET}&code=${encodeURIComponent(code)}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri('tiktok'))}`
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || (tokenData.data && tokenData.data.error_code)) {
      const msg = (tokenData.data && tokenData.data.description) || tokenData.error_description || tokenData.error || 'Unknown error';
      return res.send(errorPage('TikTok token exchange failed: ' + msg));
    }

    const data = tokenData.data || tokenData;

    // Get user info
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });
    const userData = await userRes.json();
    const user = (userData.data && userData.data.user) || {};

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    await upsertCredential({
      platform: 'tiktok',
      accountName: user.display_name || 'TikTok Account',
      accountHandle: data.open_id || null,
      credentials: { access_token: data.access_token, open_id: data.open_id },
      clientId: payload.clientId ? Number(payload.clientId) : null,
      refreshToken: data.refresh_token || null,
      tokenExpiresAt: expiresAt,
      oauthMetadata: { open_id: data.open_id, display_name: user.display_name, avatar_url: user.avatar_url }
    });

    res.send(successPage('TikTok', user.display_name));
  } catch (err) {
    console.error('TikTok OAuth callback error:', err);
    res.send(errorPage('Internal error during TikTok connection'));
  }
});


module.exports = router;
