# HEALTHCHECK RISK REGISTER

| ID   | Category     | Risk Description                                                           | Severity | Status     |
| ---- | ------------ | -------------------------------------------------------------------------- | -------- | ---------- |
| R-01 | Security     | HMAC requests bypass all RBAC checks in PermissionsGuard                   | **P0**   | UNRESOLVED |
| R-02 | Security     | Permission checks run before signature verification (Guard vs Interceptor) | **P0**   | UNRESOLVED |
| R-03 | Environment  | Config package overrides shell env with local files (override: true)       | **P0**   | UNRESOLVED |
| R-04 | Architecture | Concurrent processing risk between Internal Worker and External Worker     | **P0**   | UNRESOLVED |
| R-05 | Architecture | Lack of atomic claim transaction in Job picking logic                      | **P0**   | UNRESOLVED |
| R-06 | DevEx        | Non-blocking lint in CI masks critical structural failures                 | **P1**   | UNRESOLVED |
| R-07 | Database     | Inconsistencies in smoke database state detection (diag_db failure)        | **P2**   | UNRESOLVED |
