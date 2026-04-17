// ---------------------------------------------------------------------------
// Auth module DTOs and domain types
// ---------------------------------------------------------------------------

export interface RegisterDto {
  email:       string;
  password:    string;
  firstName:   string;
  lastName:    string;
  phone:       string;
  nationality: string;
  dateOfBirth: string;
  currency?:   string;
}

export interface LoginDto {
  email:    string;
  password: string;
}

export interface Verify2FADto {
  tempToken: string;
  totpCode:  string;
}

export interface Enable2FADto {
  totpCode: string;
}

export interface RefreshDto {
  refreshToken: string;
}

export interface ResetPasswordDto {
  token:       string;
  newPassword: string;
}

export interface OAuthCodeDto {
  code:         string;
  codeVerifier: string;
  redirectUri:  string;
}

// ── Responses ────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: SafeUser;
}

export interface Require2FAResponse {
  requires2FA: true;
  tempToken:   string;
}

export interface SafeUser {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      string;
  status:    string;
}

export interface Setup2FAResponse {
  secret:    string;
  qrCodeUrl: string;
}

// ── DB row type ───────────────────────────────────────────────────────────────

export interface UserRow {
  id:                 string;
  email:              string;  // encrypted
  phone:              string;  // encrypted
  email_hash:         string;
  password_hash:      string;
  first_name:         string;
  last_name:          string;
  nationality:        string;
  date_of_birth:      string;
  role:               string;
  status:             string;
  preferred_currency: string;
  totp_secret:        string | null;
  totp_enabled:       boolean;
  failed_login_count: number;
  locked_until:       Date | null;
  last_login_at:      Date | null;
  created_at:         Date;
  updated_at:         Date;
}
