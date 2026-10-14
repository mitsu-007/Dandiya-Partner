# Security Specification for Garba Saathi

## Data Invariants
1. Users can only read and edit their own private details in `/usersPrivate/{userId}`.
2. Unaccepted requests must NEVER reveal private WhatsApp or Instagram contact handles.
3. Once a request is accepted, private contact details are ONLY accessible to the counterpart if explicit `shareWhatsapp` or `shareInstagram` flags are enabled.
4. Users cannot modify another user's public profile, request, or notification.
5. System admin (`hgscene07@gmail.com`) can verify/unverify profiles or suspend accounts.
6. Blocked accounts or suspended accounts cannot receive or send partner requests.

## The Dirty Dozen Payloads
1. Attempting to read another student's `/usersPrivate/{otherUid}` without an accepted request.
2. Injecting `isVerified: true` or `isSuspended: false` on own profile during create/update.
3. Creating a request where `senderUid` != `request.auth.uid`.
4. Updating request status to `accepted` as the sender instead of the recipient.
5. Updating request status when caller is neither sender nor recipient.
6. Injecting extra arbitrary fields ("Shadow Update") on `requests`.
7. Oversized strings (> 1000 chars) in prompt or names to perform Denial of Wallet attacks.
8. Writing notification with `userId` belonging to another user.
9. Modifying `createdAt` on an existing request ("Immortal Field" breach).
10. Reading hidden (`isPublic: false`) or suspended user profiles from `/users` when not admin.
11. Attempting list queries without filtering by owner/authenticated status.
12. Creating duplicate requests between the same sender and recipient.
