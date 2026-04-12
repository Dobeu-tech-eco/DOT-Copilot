import { env } from '../config/env';

/**
 * Validates a URL for webhook use to prevent SSRF.
 * Rejects private IP ranges and internal hostnames.
 */
export function isValidWebhookUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Enforce HTTPS in production
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block common internal hostnames
    const blockedHostnames = ['localhost', '127.0.0.1', '::1', 'metadata.google.internal', '169.254.169.254'];
    if (blockedHostnames.includes(hostname)) {
      return false;
    }

    // This is a basic check. In a real production environment, 
    // you would want to resolve the IP and check if it's in a private range.
    // For this implementation, we will use a regex for common private ranges.
    const privateIpRegex = /^(10\.|127\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/;
    if (privateIpRegex.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a storage key to prevent path traversal.
 */
export function sanitizeStorageKey(key: string): string {
  // Remove any ../ sequences
  let sanitized = key.replace(/\.\.\//g, '');
  
  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Remove absolute path markers
  sanitized = sanitized.replace(/^([a-zA-Z]:|\/)/, '');
  
  return sanitized;
}
