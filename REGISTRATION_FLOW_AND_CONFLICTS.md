# Candidate Registration Flow & 409 Conflict RCA

## Registration flow (POST /api/candidate/register)

1. **Auth** – Require Firebase token; read `uid` from token.
2. **Validate** – `firstName`, `lastName`, `email`, `phone` (region-based phone validation).
3. **Find by current uid** – If a candidate already exists with `firebaseUid === uid`, **update** that candidate with the new form data and return success.
4. **Find by phone** (checked first) – If a candidate exists with this phone (digits or `+digits`):
   - If that candidate has a **different** `firebaseUid` → return **409** (`conflictType: 'phone'`). *E.g. user came via social login and added a phone that’s already on another profile → “Same phone already registered in another profile. Do you want to merge? Verify with OTP.”*
   - Else → **re-link**: set `firebaseUid = uid`, update name/email, save, return success.
5. **Find by email** – If a candidate exists with this email:
   - If that candidate has a **different** `firebaseUid` (another account):
     - If the **current Firebase user’s email** (from token) **matches** this email → **auto-link**: they signed in with that email (e.g. Google), so link the existing candidate to this uid and return success. No email OTP.
     - Else → return **409** (`conflictType: 'email'`).
   - Else (same uid or no uid) → **re-link**: set `firebaseUid = uid`, update name/phone, save, return success.
6. **Create** – No candidate for this uid, email, or phone → create new candidate with `firebaseUid = uid`, return 201.

## Logging (what you’ll see in server logs)

| Step | Log message |
|------|-------------|
| Start | `[register] Start` `{ uid, email, phoneDigits }` |
| Update existing | `[register] Updated existing candidate for this uid` `{ candidateId, uid }` |
| 409 email | `[register] 409 Email already registered by another account` `{ email, currentUid, existingUid, existingCandidateId }` |
| 409 phone | `[register] 409 Phone already registered by another account` `{ phoneDigits, currentUid, existingUid, existingCandidateId }` |
| Link by email | `[register] Linked existing candidate by email` `{ candidateId, uid, email }` |
| Link by phone | `[register] Linked existing candidate by phone` `{ candidateId, uid, phoneDigits }` |
| Create new | `[register] Created new candidate` `{ candidateId, uid, email, phoneDigits }` |

## Root cause: “This phone number is already registered”

**What happened**

- User signed in with **phone** (Firebase gives a **new** `uid` for this phone session).
- On “Complete profile” they entered name, email, and **the same phone number** they used to sign in.
- The backend found a **candidate** that already has this phone and is linked to a **different** `firebaseUid` (the “other” account).

**Why there are two accounts**

- **Scenario A:** They (or someone) previously registered that phone with **email** or **Google**. That created a candidate with `firebaseUid = uid_from_email_login`. Now they’re signing in with **phone**, so Firebase gives a **different** `uid`. Same person, two Firebase identities (email vs phone).
- **Scenario B:** They previously completed profile (or applied) with this phone while signed in with **phone** on another device/session, and that session had a different `uid` (e.g. reinstall, different browser).
- **Scenario C:** The number was used by another person who already has an account.

So: **one candidate record** (one email/phone) is already tied to **another** Firebase user. We don’t allow two different uids to “own” the same candidate, so we return 409 and tell them to sign in with the account that already has that phone (or use a different number).

## UX after 409

- **409 email** – UI shows “Sign in with that email” → `/login?tab=email`, **or** “Link this account”: send OTP to that email → user enters code → Verify and link (merge).
- **409 phone** – UI shows “Sign in with that phone number” → `/login?tab=phone`, **or** “Link this account”: send OTP to that phone → user enters code → Verify and link (merge). *(Phone merge requires SMS configured; otherwise user is guided to sign in with that phone.)*
- User can also change email/number and submit again.
