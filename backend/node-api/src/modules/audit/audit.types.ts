export interface LogAuditDto {
  event_type:      string;
  action:          string;
  actor_id?:       string;
  target_id?:      string;
  target_type?:    string;
  metadata?:       Record<string, unknown>;
  correlation_id?: string;
  ip_address?:     string;
  user_agent?:     string;
}

export interface AuditQueryFilter {
  actor_id?:   string;
  target_id?:  string;
  event_type?: string;
  from?:       string;
  to?:         string;
  limit?:      number;
  offset?:     number;
}
