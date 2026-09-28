/**
 * Instagram Input Parser & Formatter
 * 
 * Automatically detects whether client/user entered:
 * - A full link (e.g. https://instagram.com/username, https://www.instagram.com/username/?igsh=xxx)
 * - A link without protocol (e.g. instagram.com/username, www.instagram.com/username)
 * - A double nested link (e.g. https://instagram.com/https://instagram.com/username)
 * - A username with @ (e.g. @username)
 * - A plain username (e.g. username)
 * 
 * Accurately extracts clean username and standardizes proper clickable URL.
 */

export function parseInstagramInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { username: '', link: '' };
  }

  let str = rawInput.trim();
  if (!str) {
    return { username: '', link: '' };
  }

  // Handle nested or repeated "instagram.com/" prefixes
  while (str.includes('instagram.com/')) {
    str = str.substring(str.indexOf('instagram.com/') + 'instagram.com/'.length).trim();
  }

  // Remove any leading protocols or www
  str = str.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');

  // Strip leading '@' or slashes
  str = str.replace(/^[@/]+/, '');

  // Match valid Instagram handle (letters, numbers, periods, underscores, hyphens)
  const match = str.match(/^([a-zA-Z0-9._-]+)/);
  const username = match ? match[1].replace(/^@+/, '').trim() : '';

  const link = username ? `https://instagram.com/${username}` : '';

  return {
    username,
    link
  };
}

export function formatInstagramLink(rawInput) {
  const { link } = parseInstagramInput(rawInput);
  return link;
}

export function formatInstagramUsername(rawInput) {
  const { username } = parseInstagramInput(rawInput);
  return username;
}

/**
 * Resolves Instagram details from a user/client object.
 * Checks multiple possible fields (instagramId, instagram_link, instagram, insta_link).
 */
export function getInstagramDetails(userOrClient) {
  if (!userOrClient) return { username: '', link: '' };

  const possible = [
    userOrClient.instagramId,
    userOrClient.instagram_link,
    userOrClient.instagram,
    userOrClient.insta_link,
    userOrClient.insta
  ];

  for (const val of possible) {
    if (val && typeof val === 'string' && val.trim()) {
      const parsed = parseInstagramInput(val);
      if (parsed.username) {
        return parsed;
      }
    }
  }

  return { username: '', link: '' };
}
