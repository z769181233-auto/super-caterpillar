/**
 * CE02 Identity Lock Engine - Real Implementation
 *
 * 功能：角色一致性锁定 (Hardened)
 */

import { createHash } from 'crypto';
import { CE02IdentityLockInput, CE02IdentityLockOutput, LockedCharacter } from './types';

/**
 * CE02 Real Engine (Stub Implementation)
 */
export async function ce02RealEngine(
  input: CE02IdentityLockInput
): Promise<CE02IdentityLockOutput> {
  throw new Error("CE02_SERVICE_UNAVAILABLE: Real implementation must be injected via CharacterService. Absolute truth only.");
}
