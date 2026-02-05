# SEAL INDEX

## P6-1-5 BUSINESS SEALED (CONSOLIDATED)
- **Status**: BUSINESS SEALED (PATCH APPLIED)
- **Primary Tag**: P6-1-5_BILLING_BUSINESS_SEALED_PATCH_20260205_213343
- **Supersedes**: P6-1-5_BILLING_BUSINESS_SEALED_20260205_210633 (Manual phrasing correction)
- **Evidence**: docs/_evidence/p6_1_5_billing_business_verify_patch_20260205_211959/
- **Consolidation Trace**: EVI=docs/_evidence/p6_1_5_doc_hygiene_20260205_214204/

## P6-2 ERROR MATRIX (PATCH SEALED)
- **Status**: PATCH SEALED (HARDENED)
- **Primary Tag**: P6-2_ERROR_MATRIX_PATCH_20260205_230702
- **Evidence**: docs/_evidence/p6_2_error_matrix_20260205_230211/
- **Gate**: tools/gate/gates/gate_p6_2_error_matrix.sh
- **Notes**:
  - Case03 uses gate_security_negative.sh (real auth/HMAC failure) and enforces Ledger delta=0.
  - Case04 uses PID SSOT + port fallback; includes curl/psql timeouts to prevent hangs.
