# Fix Academy Creation - Implementation Plan

## Problem
The current `createAcademy` function in `academy.service.ts` performs multiple independent Supabase operations:
1. Create Academy
2. Create Admin User
3. Link User to Academy

If step 2 fails (e.g., email already exists), step 1 is not rolled back, leading to an "orphan" academy without an admin user. If step 3 fails, we have an academy and a user but no link.

## Proposed Solution
Move the entire logic into a single Postgres function (RPC) to ensure atomicity. This way, if any part fails, the entire transaction is rolled back by the database.

## Changes

### 1. Database - Create RPC Function [NEW]
Create a new SQL function `create_academy_with_user` that accepts:
- Academy details
- User (admin) details

And performs:
1. Insert into `academies`
2. Insert into `users`
3. Insert into `academy_users`

### 2. Frontend - Update Service [MODIFY]
Update `src/shared/services/academy.service.ts`:
- Modify `createAcademy` to call `supabase.rpc('create_academy_with_user', { ... })` instead of manual chained calls.

## Verification Plan

### Manual Verification
1. Attempt to create an academy with a UNIQUE email.
   - Result: Success. Academy created, User created, Link created.
2. Attempt to create an academy with an EXISTING email.
   - Result: Failure. **Verify that NO academy was created in the `academies` table.**

### Automated Tests
- None (User handles testing manually).
