export const SECURITY_PATTERNS = {
  secrets: [
    /ghp_[a-zA-Z0-9]{36}/g,           // GitHub PAT
    /sk-[a-zA-Z0-9]{48}/g,            // OpenAI key
    /AKIA[0-9A-Z]{16}/g,              // AWS key
    /(?:password|secret|key)['"]?\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  ],
  sqlInjection: [
    /execute\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi,  // String interpolation in SQL
    /query\s*\(\s*['"`].*\+.*['"`]\s*\)/gi,          // String concat in SQL
  ],
  xss: [
    /innerHTML\s*=\s*[^;]*\$/gi,      // Dynamic innerHTML
    /dangerouslySetInnerHTML/gi,       // React footgun
  ]
};