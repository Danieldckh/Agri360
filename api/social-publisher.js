/**
 * Social Publisher — background worker that auto-publishes scheduled posts
 * and provides per-platform posting functions.
 *
 * Started by server.js at boot. Polls every 60 seconds for posts with
 * status='scheduled' and scheduled_at <= NOW(), then publishes them
 * to the connected platforms.
 */

const fetch = require('node-fetch');
const pool = require('./db');
const config = require('./config');

// ── Token Refresh ────────────────────────────────────────────────

async function refreshTwitterToken(credId, refreshToken) {
  if (!refreshToken || !config.TWITTER_CLIENT_ID) return null;
  const basicAuth = Buffer.from(`${config.TWITTER_CLIENT_ID}:${config.TWITTER_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  const data = await res.json();
  if (data.error) throw new Error('Twitter refresh failed: ' + (data.error_description || data.error));

  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;
  await pool.query(
    `UPDATE social_credentials SET credentials = jsonb_set(credentials, '{access_token}', $1::jsonb),
       refresh_token = $2, token_expires_at = $3, updated_at = NOW() WHERE id = $4`,
    [JSON.stringify(data.access_token), data.refresh_token || refreshToken, expiresAt, credId]
  );
  return data.access_token;
}

async function refreshLinkedInToken(credId, refreshToken) {
  if (!refreshToken || !config.LINKEDIN_CLIENT_ID) return null;
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${config.LINKEDIN_CLIENT_ID}&client_secret=${config.LINKEDIN_CLIENT_SECRET}`
  });
  const data = await res.json();
  if (data.error) throw new Error('LinkedIn refresh failed: ' + (data.error_description || data.error));

  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;
  await pool.query(
    `UPDATE social_credentials SET credentials = jsonb_set(credentials, '{access_token}', $1::jsonb),
       refresh_token = $2, token_expires_at = $3, updated_at = NOW() WHERE id = $4`,
    [JSON.stringify(data.access_token), data.refresh_token || refreshToken, expiresAt, credId]
  );
  return data.access_token;
}

async function refreshGoogleToken(credId, refreshToken) {
  if (!refreshToken || !config.GOOGLE_CLIENT_ID) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${config.GOOGLE_CLIENT_ID}&client_secret=${config.GOOGLE_CLIENT_SECRET}`
  });
  const data = await res.json();
  if (data.error) throw new Error('Google refresh failed: ' + (data.error_description || data.error));

  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;
  await pool.query(
    `UPDATE social_credentials SET credentials = jsonb_set(credentials, '{access_token}', $1::jsonb),
       token_expires_at = $2, updated_at = NOW() WHERE id = $3`,
    [JSON.stringify(data.access_token), expiresAt, credId]
  );
  return data.access_token;
}

async function refreshTikTokToken(credId, refreshToken) {
  if (!refreshToken || !config.TIKTOK_CLIENT_KEY) return null;
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_key=${config.TIKTOK_CLIENT_KEY}&client_secret=${config.TIKTOK_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  const data = await res.json();
  const inner = data.data || data;
  if (inner.error_code) throw new Error('TikTok refresh failed: ' + (inner.description || inner.error_code));

  const expiresAt = inner.expires_in ? new Date(Date.now() + inner.expires_in * 1000).toISOString() : null;
  await pool.query(
    `UPDATE social_credentials SET credentials = jsonb_set(credentials, '{access_token}', $1::jsonb),
       refresh_token = $2, token_expires_at = $3, updated_at = NOW() WHERE id = $4`,
    [JSON.stringify(inner.access_token), inner.refresh_token || refreshToken, expiresAt, credId]
  );
  return inner.access_token;
}

// Get a fresh access token, refreshing if expired
async function getFreshToken(cred) {
  // Check if token is expired or about to expire (within 5 min)
  if (cred.token_expires_at) {
    const expiresAt = new Date(cred.token_expires_at);
    const buffer = 5 * 60 * 1000; // 5 minutes
    if (expiresAt.getTime() - Date.now() < buffer) {
      console.log(`[publisher] Refreshing ${cred.platform} token for credential ${cred.id}`);
      try {
        if (cred.platform === 'twitter') return await refreshTwitterToken(cred.id, cred.refresh_token);
        if (cred.platform === 'linkedin') return await refreshLinkedInToken(cred.id, cred.refresh_token);
        if (cred.platform === 'youtube') return await refreshGoogleToken(cred.id, cred.refresh_token);
        if (cred.platform === 'tiktok') return await refreshTikTokToken(cred.id, cred.refresh_token);
      } catch (err) {
        console.error(`[publisher] Token refresh failed for credential ${cred.id}:`, err.message);
        return null;
      }
    }
  }
  // Return existing token
  const credentials = typeof cred.credentials === 'string' ? JSON.parse(cred.credentials) : cred.credentials;
  return credentials.access_token;
}


// ── Platform-Specific Publishing ─────────────────────────────────

async function publishToFacebook(cred, post) {
  const credentials = typeof cred.credentials === 'string' ? JSON.parse(cred.credentials) : cred.credentials;
  const pageId = credentials.page_id;
  const token = credentials.access_token;
  if (!pageId || !token) throw new Error('Facebook credentials incomplete (missing page_id or access_token)');

  const body = {};
  // Build message from content + hashtags
  let message = post.content || '';
  if (post.hashtags) message += '\n\n' + post.hashtags;
  if (message) body.message = message;
  if (post.link_url) body.link = post.link_url;

  // If there are media URLs, post as a photo (first image)
  const mediaUrls = typeof post.media_urls === 'string' ? JSON.parse(post.media_urls) : (post.media_urls || []);
  if (mediaUrls.length > 0) {
    // Post as a photo with the first image
    const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrls[0], caption: message || '', access_token: token })
    });
    const photoData = await photoRes.json();
    if (photoData.error) throw new Error('Facebook photo post failed: ' + photoData.error.message);
    return { postId: photoData.id || photoData.post_id, type: 'photo' };
  }

  // Text/link post
  body.access_token = token;
  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.error) throw new Error('Facebook post failed: ' + data.error.message);
  return { postId: data.id, type: 'feed' };
}

async function publishToInstagram(cred, post) {
  const credentials = typeof cred.credentials === 'string' ? JSON.parse(cred.credentials) : cred.credentials;
  const igUserId = credentials.ig_user_id;
  const token = credentials.access_token;
  if (!igUserId || !token) throw new Error('Instagram credentials incomplete');

  const mediaUrls = typeof post.media_urls === 'string' ? JSON.parse(post.media_urls) : (post.media_urls || []);
  if (mediaUrls.length === 0) throw new Error('Instagram requires at least one image to post');

  let caption = post.content || '';
  if (post.hashtags) caption += '\n\n' + post.hashtags;

  // Step 1: Create media container
  const containerBody = { image_url: mediaUrls[0], caption: caption, access_token: token };
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody)
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error('Instagram container creation failed: ' + containerData.error.message);

  // Step 2: Publish the container
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerData.id, access_token: token })
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error('Instagram publish failed: ' + publishData.error.message);

  return { postId: publishData.id, type: 'image' };
}

async function publishToTwitter(cred, post) {
  const token = await getFreshToken(cred);
  if (!token) throw new Error('Twitter access token unavailable');

  let text = '';
  if (post.title) text += post.title + '\n\n';
  if (post.content) text += post.content;
  if (post.hashtags) text += '\n\n' + post.hashtags;
  if (post.link_url) text += '\n\n' + post.link_url;

  // Twitter has a 280-char limit; truncate if needed
  if (text.length > 280) text = text.slice(0, 277) + '...';

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (data.errors || data.detail) {
    throw new Error('Twitter post failed: ' + (data.detail || JSON.stringify(data.errors)));
  }
  return { postId: data.data && data.data.id, type: 'tweet' };
}

async function publishToLinkedIn(cred, post) {
  const token = await getFreshToken(cred);
  if (!token) throw new Error('LinkedIn access token unavailable');

  const credentials = typeof cred.credentials === 'string' ? JSON.parse(cred.credentials) : cred.credentials;
  const authorUrn = credentials.person_urn;
  if (!authorUrn) throw new Error('LinkedIn person URN missing');

  let commentary = '';
  if (post.title) commentary += post.title + '\n\n';
  if (post.content) commentary += post.content;
  if (post.hashtags) commentary += '\n\n' + post.hashtags;

  const body = {
    author: authorUrn,
    commentary: commentary,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED'
  };

  // Add article/link if present
  if (post.link_url) {
    body.content = {
      article: {
        source: post.link_url,
        title: post.title || '',
        description: (post.content || '').slice(0, 200)
      }
    };
  }

  const res = await fetch('https://api.linkedin.com/v2/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(body)
  });

  if (res.status === 201) {
    const postUrn = res.headers.get('x-restli-id') || 'unknown';
    return { postId: postUrn, type: 'post' };
  }

  const errData = await res.json().catch(() => ({}));
  throw new Error('LinkedIn post failed (' + res.status + '): ' + (errData.message || JSON.stringify(errData)));
}

async function publishToYouTube(cred, post) {
  // YouTube is video-only — we can only post if there's a video URL in media
  const token = await getFreshToken(cred);
  if (!token) throw new Error('YouTube access token unavailable');

  // For now, YouTube posting requires video content which isn't supported via URL upload
  // through the scheduler's simple media_urls field. Mark as a known limitation.
  throw new Error('YouTube auto-posting requires video upload which is not yet supported via the scheduler. Upload videos directly to YouTube Studio.');
}

async function publishToTikTok(cred, post) {
  // TikTok is video-only — requires video file upload
  const token = await getFreshToken(cred);
  if (!token) throw new Error('TikTok access token unavailable');

  throw new Error('TikTok auto-posting requires video upload which is not yet supported via the scheduler. Upload videos directly to TikTok.');
}

// ── Publish a Single Post ────────────────────────────────────────

const PUBLISHERS = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  twitter: publishToTwitter,
  linkedin: publishToLinkedIn,
  youtube: publishToYouTube,
  tiktok: publishToTikTok,
};

/**
 * Publish a scheduled_post row to all its target platforms.
 * Returns { success: boolean, results: { [platform]: { ok, postId?, error? } } }
 */
async function publishPost(postRow) {
  const platforms = typeof postRow.platforms === 'string' ? JSON.parse(postRow.platforms) : (postRow.platforms || []);
  if (platforms.length === 0) return { success: false, results: {}, error: 'No platforms specified' };

  // Look up credentials for this post's client + platforms
  const credResult = await pool.query(
    `SELECT * FROM social_credentials
     WHERE is_active = TRUE
       AND (client_id = $1 OR ($1 IS NULL AND client_id IS NULL))
       AND platform = ANY($2::text[])`,
    [postRow.client_id, platforms]
  );
  const credsByPlatform = {};
  credResult.rows.forEach(c => { credsByPlatform[c.platform] = c; });

  const results = {};
  let anySuccess = false;
  const errors = [];

  for (const platform of platforms) {
    const cred = credsByPlatform[platform];
    if (!cred) {
      results[platform] = { ok: false, error: 'No active credential found' };
      errors.push(`${platform}: no credential`);
      continue;
    }

    const publishFn = PUBLISHERS[platform];
    if (!publishFn) {
      results[platform] = { ok: false, error: 'Unsupported platform' };
      errors.push(`${platform}: unsupported`);
      continue;
    }

    try {
      const result = await publishFn(cred, postRow);
      results[platform] = { ok: true, postId: result.postId, type: result.type };
      anySuccess = true;
    } catch (err) {
      console.error(`[publisher] Failed to publish post ${postRow.id} to ${platform}:`, err.message);
      results[platform] = { ok: false, error: err.message };
      errors.push(`${platform}: ${err.message}`);
    }
  }

  // Update the post status
  const newStatus = anySuccess ? 'posted' : 'failed';
  const postError = errors.length > 0 ? errors.join('; ') : null;

  await pool.query(
    `UPDATE scheduled_posts SET status = $1, posted_at = $2, post_error = $3, updated_at = NOW() WHERE id = $4`,
    [newStatus, anySuccess ? new Date().toISOString() : null, postError, postRow.id]
  );

  return { success: anySuccess, results, error: postError };
}


// ── Background Worker ────────────────────────────────────────────

let intervalHandle = null;

async function tick() {
  try {
    // Find posts that are scheduled and due
    const result = await pool.query(
      `SELECT * FROM scheduled_posts
       WHERE status = 'scheduled'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT 10`
    );

    for (const post of result.rows) {
      console.log(`[publisher] Publishing post ${post.id} (scheduled for ${post.scheduled_at})`);
      try {
        const outcome = await publishPost(post);
        console.log(`[publisher] Post ${post.id}: ${outcome.success ? 'SUCCESS' : 'FAILED'} — ${JSON.stringify(outcome.results)}`);
      } catch (err) {
        console.error(`[publisher] Unexpected error publishing post ${post.id}:`, err.message);
        await pool.query(
          `UPDATE scheduled_posts SET status = 'failed', post_error = $1, updated_at = NOW() WHERE id = $2`,
          [err.message, post.id]
        );
      }
    }
  } catch (err) {
    console.error('[publisher] Tick error:', err.message);
  }
}

// Also refresh tokens that are about to expire (within 30 min)
async function refreshExpiringTokens() {
  try {
    const result = await pool.query(
      `SELECT * FROM social_credentials
       WHERE is_active = TRUE
         AND token_expires_at IS NOT NULL
         AND token_expires_at < NOW() + INTERVAL '30 minutes'
         AND refresh_token IS NOT NULL`
    );
    for (const cred of result.rows) {
      console.log(`[publisher] Pre-refreshing ${cred.platform} token for credential ${cred.id}`);
      try {
        await getFreshToken(cred);
      } catch (err) {
        console.error(`[publisher] Pre-refresh failed for credential ${cred.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[publisher] Token refresh sweep error:', err.message);
  }
}

function start() {
  if (intervalHandle) return;
  console.log('[publisher] Background social publisher started (60s interval)');

  // Run first tick after a short delay to let DB migrations finish
  setTimeout(() => {
    tick();
    refreshExpiringTokens();
  }, 5000);

  // Then poll every 60 seconds
  intervalHandle = setInterval(() => {
    tick();
  }, 60 * 1000);

  // Refresh tokens every 15 minutes
  setInterval(() => {
    refreshExpiringTokens();
  }, 15 * 60 * 1000);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { start, stop, publishPost };
