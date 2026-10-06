# HATI 🇵🇭 — Filipino-First Expense Splitting App
## MVP Build Plan for Claude Code

> **Purpose:** This document is the implementation brief for Claude Code. Build the MVP from this specification without adding unnecessary features.
>
> **Product idea:** A Filipino-first Splitwise-style app for barkadas, trips, school projects, households, and small groups. Users record shared expenses, calculate who owes whom, track settlements, and send friendly payment reminders.
>
> **MVP principle:** Make the smallest useful product that completes this loop:
>
> **Create group → Add expense → Calculate balances → Remind → Mark paid**

---

# 1. Product Definition

## Working name

**HATI**

### Tagline

**“Sino may bayad? Sino may utang? Hati na.”**

The name can be changed later. Keep the codebase easy to rename.

## Target users

Primary:
- Filipino students
- Barkadas
- Couples/friends
- Travelers
- Roommates/boarding-house groups
- School project groups
- Small event groups

## Filipino-first UX

The product should feel local through functionality, not just branding:

- Philippine Peso (`₱`) as default currency
- GCash/Maya-friendly settlement workflow
- Filipino-friendly reminder copy
- Group examples such as `Barkada`, `Boracay Trip`, `Research Project`, `Apartment`
- Use familiar terms such as `Utang`, `Bayad`, `Hati`, `Paki-GCash`
- English can remain the primary UI language for MVP, with Filipino copy where it improves the experience

---

# 2. MVP Scope

## MUST HAVE

### Authentication
- Sign up
- Log in
- Log out
- Basic profile

### Groups
- Create group
- View groups
- View group details
- Add members
- Leave group

### Expenses
- Add expense
- Expense description
- Amount
- Paid by
- Split equally
- Split by exact amount
- View expense details
- Delete own expense

### Balances
- Calculate net balances
- Show “You owe”
- Show “You’re owed”
- Show individual balances
- Show simplified settlement suggestions

### Settlements
- Record a payment/settlement
- Mark debt as settled
- Settlement history

### Reminders
- Generate a shareable/copyable payment reminder
- Example:
  `Uy Juan! Paki-GCash naman ng ₱400 for dinner kanina 😭 Salamat!`

### Dashboard
- Total amount owed by user
- Total amount user is owed
- Recent groups
- Recent activity

---

# 3. OUT OF SCOPE FOR MVP

Do NOT implement these unless explicitly requested later:

- GCash API/payment integration
- Maya API/payment integration
- Bank integrations
- Receipt OCR
- AI expense parsing
- Item-level receipt splitting
- Recurring expenses
- Multi-currency
- Cryptocurrency
- Investments
- Budgeting
- Financial advice
- Social feed
- Chat
- Public groups
- Ads
- Paid subscriptions
- Advanced analytics
- Complex admin dashboard

Use architecture that allows these later, but do not build them now.

---

# 4. Recommended Tech Stack

Use a modern, simple stack.

## Frontend

- React Native
- Expo
- TypeScript
- Expo Router
- React Hook Form
- Zod
- TanStack Query where useful

## Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Row Level Security

## State

Prefer server state through TanStack Query/Supabase.
Avoid unnecessary global state.

## Styling

Use a consistent component system.

Recommended:
- NativeWind OR a simple custom StyleSheet-based system

Pick ONE. Do not install multiple styling systems.

## Notifications

For MVP, do not build a full push-notification backend.

Use:
- Share/copy reminder
- Optional local notification architecture only if straightforward

---

# 5. Repository Structure

Use a clean structure similar to:

```text
hati/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── auth/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── index.tsx
│   │   ├── groups.tsx
│   │   ├── activity.tsx
│   │   └── profile.tsx
│   ├── groups/
│   │   ├── create.tsx
│   │   ├── [id].tsx
│   │   ├── [id]/add-expense.tsx
│   │   └── [id]/settle.tsx
│   └── expenses/
│       └── [id].tsx
├── components/
├── features/
│   ├── auth/
│   ├── groups/
│   ├── expenses/
│   ├── balances/
│   └── settlements/
├── lib/
│   ├── supabase.ts
│   ├── currency.ts
│   └── calculations.ts
├── hooks/
├── types/
├── constants/
├── supabase/
│   └── migrations/
├── tests/
└── README.md
```

Claude Code may adjust the structure if the selected framework requires it, but preserve feature separation.

---

# 6. Database Schema

Use PostgreSQL through Supabase.

## profiles

```sql
id uuid primary key references auth.users(id)
display_name text not null
avatar_url text null
gcash_number text null
maya_number text null
created_at timestamptz default now()
updated_at timestamptz default now()
```

Do not expose payment numbers publicly outside appropriate group/member contexts.

## groups

```sql
id uuid primary key
name text not null
description text null
created_by uuid references profiles(id)
created_at timestamptz default now()
updated_at timestamptz default now()
```

## group_members

```sql
group_id uuid references groups(id) on delete cascade
user_id uuid references profiles(id) on delete cascade
joined_at timestamptz default now()
primary key (group_id, user_id)
```

## expenses

```sql
id uuid primary key
group_id uuid references groups(id) on delete cascade
description text not null
amount numeric(12,2) not null
paid_by uuid references profiles(id)
created_by uuid references profiles(id)
split_method text not null
created_at timestamptz default now()
updated_at timestamptz default now()
```

Allowed `split_method` values for MVP:

```text
equal
exact
```

## expense_splits

```sql
id uuid primary key
expense_id uuid references expenses(id) on delete cascade
user_id uuid references profiles(id)
amount_owed numeric(12,2) not null
created_at timestamptz default now()
```

## settlements

```sql
id uuid primary key
group_id uuid references groups(id) on delete cascade
from_user uuid references profiles(id)
to_user uuid references profiles(id)
amount numeric(12,2) not null
created_by uuid references profiles(id)
created_at timestamptz default now()
```

---

# 7. Security / RLS

Supabase Row Level Security is REQUIRED.

Users must only be able to:

- Read groups they belong to
- Read members of groups they belong to
- Read expenses from groups they belong to
- Read expense splits from groups they belong to
- Read settlements from groups they belong to
- Create expenses in groups they belong to
- Create settlements in groups they belong to
- Update/delete only records they are authorized to modify

Do NOT rely only on frontend checks.

Implement and test RLS policies.

---

# 8. Core Balance Algorithm

This is the most important business logic.

For each expense:

```text
payer receives credit = expense amount

each participant receives debt = their split amount
```

For every user:

```text
net_balance =
    amount_paid
    - amount_they_owe
    + settlements_received
    - settlements_sent
```

Interpretation:

```text
positive = user is owed money
negative = user owes money
zero = settled
```

Example:

```text
Dinner = ₱2,400

Michael paid ₱2,400

Michael owes ₱600
Juan owes ₱600
Ana owes ₱600
Bea owes ₱600

Net:
Michael +₱1,800
Juan   -₱600
Ana    -₱600
Bea    -₱600
```

The implementation MUST avoid floating-point currency errors.

Use integer centavos internally where practical, or PostgreSQL numeric values with safe decimal handling.

---

# 9. Settlement Simplification

Implement a simple debt simplification algorithm.

Example:

```text
Michael +₱1,000
Juan    -₱600
Ana     -₱400
```

Suggested settlements:

```text
Juan → Michael ₱600
Ana  → Michael ₱400
```

Do not attempt an overly complex optimization algorithm for MVP.

The goal is to reduce unnecessary transactions while preserving total balances.

Create unit tests for:

1. One payer / equal split
2. Multiple payers
3. Exact split
4. Partial settlement
5. Fully settled group
6. Multiple debtors and creditors
7. Rounding edge cases

---

# 10. Expense Creation UX

## Screen

```text
Add Expense

Amount
₱ 0.00

Description
Dinner

Paid by
Michael ▼

Split
○ Equally
○ Exact amounts

Split between

☑ Michael     ₱600
☑ Juan        ₱600
☑ Ana         ₱600
☑ Bea         ₱600

Total
₱2,400 / ₱2,400

[ Add Expense ]
```

Validation:

- Amount > 0
- Description required
- Payer must be a group member
- At least one participant
- Equal split must total exactly to expense
- Exact split must total exactly to expense
- Prevent invalid/negative amounts

---

# 11. Group Detail Screen

Example:

```text
Boracay 2026 🏝️

5 members

You owe
₱350

You're owed
₱850

--------------------

Recent Expenses

🍕 Dinner
Michael paid ₱2,400
You owe ₱600

🚕 Grab
Ana paid ₱800
You owe ₱200

🏨 Hotel
Michael paid ₱5,000
You owe ₱1,250

--------------------

[ + Add Expense ]

[ View Balances ]
```

---

# 12. Dashboard

Home screen:

```text
Good morning 👋

You're owed
₱850

You owe
₱350

Net
+₱500

----------------

Your Groups

🏝️ Boracay 2026
🎓 Research Project
🍜 Barkada
🏠 Apartment

----------------

Recent Activity
...
```

The dashboard should load quickly and avoid unnecessary queries.

---

# 13. Reminder Feature

When a user owes someone money:

```text
Juan owes Michael ₱400
```

Show:

```text
[ Paki-GCash 😭 ]
```

On press, generate:

```text
Uy Juan! Paki-GCash naman ng ₱400 for dinner kanina 😭
Salamat!
```

Provide:

- Copy
- Share

If GCash/Maya information is available:

```text
GCash: 09XXXXXXXXX
```

Do not automatically send messages in MVP.

---

# 14. Onboarding

Keep onboarding short.

### Screen 1

```text
HATI 🇵🇭

Sino may bayad?
Sino may utang?
Hati na.

[ Get Started ]
```

### Screen 2

```text
Split bills with your barkada.
Track every utang.
Settle without the mental math.

[ Continue ]
```

### Screen 3

```text
Create your profile

Name
[ Michael ]

[ Continue ]
```

Then land on Home.

---

# 15. Design Direction

## Visual personality

Modern Filipino fintech, but friendly.

Avoid:
- Corporate banking aesthetic
- Overly childish graphics
- Excessive gradients
- Clutter
- Too many illustrations

Aim for:
- Clean
- Friendly
- Fast
- Mobile-first
- Trustworthy
- Slightly playful

## Currency

Always format Philippine peso:

```text
₱1,250.00
```

For compact displays:

```text
₱1,250
```

Use `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })` or equivalent.

---

# 16. Navigation

Recommended tabs:

```text
Home
Groups
Activity
Profile
```

Primary CTA:

```text
+ Add Expense
```

It should be accessible from Home and Group screens.

---

# 17. MVP User Stories

## Authentication

- As a user, I can create an account.
- As a user, I can log in.
- As a user, I can log out.
- As a user, I can edit my profile.

## Groups

- As a user, I can create a group.
- As a user, I can see groups I belong to.
- As a user, I can add members.
- As a user, I can leave a group.

## Expenses

- As a user, I can record an expense.
- As a user, I can choose who paid.
- As a user, I can split equally.
- As a user, I can split by exact amounts.
- As a user, I can view expense details.
- As a user, I can delete an expense I created.

## Balances

- As a user, I can see what I owe.
- As a user, I can see what others owe me.
- As a user, I can see simplified settlement suggestions.

## Settlement

- As a user, I can record a payment.
- As a user, I can mark a debt as settled.
- As a user, I can view settlement history.

## Reminders

- As a user, I can generate a friendly reminder.
- As a user, I can copy/share the reminder.

---

# 18. Development Phases

## Phase 0 — Project Setup

Tasks:

- Initialize Expo app
- TypeScript
- Expo Router
- Install Supabase client
- Configure environment variables
- Configure linting/formatting
- Configure testing
- Create base design tokens
- Create README

Deliverable:

```text
App launches successfully.
Navigation works.
Supabase connection works.
```

---

## Phase 1 — Authentication

Build:

- Login
- Signup
- Logout
- Session persistence
- Profile creation

Acceptance:

- New user can register
- Existing user can log in
- Session survives app restart
- Logout works

---

## Phase 2 — Groups

Build:

- Create group
- Group list
- Group detail
- Add member
- Leave group

For MVP, member discovery can be simple.

Recommended initial approach:

- Search users by email
- Add user to group

Do not build contacts synchronization.

---

## Phase 3 — Expenses

Build:

- Add expense
- Equal split
- Exact split
- Expense detail
- Delete expense
- Validation

Write calculation tests before connecting the UI to the calculation layer.

---

## Phase 4 — Balances

Build:

- User net balance
- Group balances
- Who owes whom
- Simplified settlements

This should use reusable pure functions.

Example:

```ts
calculateGroupBalances(expenses, settlements)
simplifyDebts(balances)
```

Do not place financial calculations directly inside React components.

---

## Phase 5 — Settlements

Build:

- Record settlement
- Settlement history
- Update balances after settlement
- Mark payment as completed

---

## Phase 6 — Reminders

Build:

- Generate reminder text
- Copy to clipboard
- Native share sheet
- Optional GCash/Maya details in profile

---

## Phase 7 — Polish

Test:

- Empty states
- Loading states
- Error states
- Offline/error recovery
- Form validation
- Keyboard behavior
- Currency formatting
- Long names
- Large amounts
- Small amounts
- Dark/light appearance if supported

---

# 19. Seed/Test Data

Create development seed data.

Example group:

```text
Boracay 2026
```

Members:

```text
Michael
Juan
Ana
Bea
Carlo
```

Expenses:

```text
Dinner       ₱2,400
Hotel        ₱5,000
Grab         ₱800
Beach fees   ₱1,000
```

Include multiple payers.

This makes it possible to visually test balance calculations.

---

# 20. Testing Requirements

## Unit tests

At minimum:

```text
currency formatting
equal split
exact split validation
balance calculation
settlement calculation
debt simplification
rounding
```

## Integration tests

Test:

```text
Create account
Create group
Add member
Add expense
View balance
Record settlement
Balance updates
```

## Security tests

Verify:

```text
User A cannot read User B's private group
User A cannot modify User B's expense
User outside group cannot read group expenses
```

RLS must be tested against Supabase.

---

# 21. Definition of Done

The MVP is complete only when a new user can:

1. Sign up
2. Create a group
3. Add another user
4. Add a ₱2,400 expense
5. Select who paid
6. Split it equally
7. See exactly who owes whom
8. Generate a “Paki-GCash” reminder
9. Record a settlement
10. See the balances update correctly
11. Close/reopen the app and retain data

There must be no fake/mock balance data in production flows.

---

# 22. Claude Code Instructions

Claude Code should work in small, verifiable increments.

## Required workflow

For every phase:

1. Inspect the repository.
2. Identify existing architecture.
3. Implement the smallest coherent change.
4. Run TypeScript checks.
5. Run lint.
6. Run relevant tests.
7. Fix failures.
8. Review for security issues.
9. Summarize changes.
10. Proceed to the next phase only when the current phase is stable.

Do NOT rewrite the entire project unnecessarily.

Do NOT introduce a new library when existing dependencies can solve the problem.

Do NOT create placeholder functionality that looks complete but does not work.

---

# 23. Claude Code Task Order

Execute in this order:

```text
TASK 001
Project initialization

TASK 002
Supabase configuration

TASK 003
Database migrations

TASK 004
RLS policies

TASK 005
Authentication

TASK 006
Profile

TASK 007
Groups

TASK 008
Group members

TASK 009
Expense model

TASK 010
Balance calculation engine

TASK 011
Expense UI

TASK 012
Balance UI

TASK 013
Debt simplification

TASK 014
Settlements

TASK 015
Reminder/share flow

TASK 016
Dashboard

TASK 017
Error/loading/empty states

TASK 018
Unit tests

TASK 019
Integration tests

TASK 020
Security review

TASK 021
Production build verification
```

---

# 24. Important Engineering Rules

### Rule 1 — Business logic must be testable

Do not bury calculations inside UI.

Bad:

```text
React component calculates balances
```

Good:

```text
features/balances/calculations.ts
```

with pure functions.

### Rule 2 — Money must be precise

Never depend on JavaScript floating-point arithmetic for financial calculations.

### Rule 3 — Server is authoritative

The client must not be trusted to enforce:

- group membership
- ownership
- permissions
- balances
- settlement validity

### Rule 4 — RLS is mandatory

Every Supabase table containing user/group data must have appropriate RLS policies.

### Rule 5 — Keep MVP small

If a feature is not required to complete:

```text
expense → balance → settlement
```

leave it out.

---

# 25. Future Roadmap — NOT MVP

Potential V2:

- Receipt scanning
- Item-level splitting
- Recurring expenses
- Push reminders
- Deep GCash/Maya integrations
- QR-based group joining
- Invite links
- Group expense categories
- Expense search
- CSV/PDF export
- Offline-first mode
- Multiple currencies
- Filipino/English language switch
- Dark mode
- Widgets

Potential V3:

- Smart receipt OCR
- AI expense extraction
- Automatic settlement optimization
- Payment integrations
- Business/event mode
- Family/shared household mode

---

# 26. Product Success Metrics

For the first MVP, measure:

### Activation

Percentage of users who:

```text
Sign up
→ create group
→ add first expense
```

### Core action

Number of expenses created per active user.

### Settlement

Percentage of groups where at least one settlement is recorded.

### Retention

7-day and 30-day returning users.

### Viral behavior

Number of invited/added members per group.

The most important initial metric:

> **Does a user successfully record a real shared expense and use HATI to settle it?**

---

# 27. Launch Strategy

Do not launch broadly first.

Start with a small beta:

```text
20–50 users
```

Target:

- Friends
- Students
- Barkadas
- School organizations
- Small travel groups

Ask only a few questions:

1. What did you use HATI for?
2. Was adding an expense easy?
3. Did the balance make sense?
4. Did you actually use it to settle a debt?
5. What was confusing?

Prioritize real usage over feature requests.

---

# 28. Final MVP Summary

HATI should NOT try to become a complete personal finance app.

It should become the easiest way for Filipinos to answer:

> **“Sino may utang sa akin?”**
>
> **“Magkano utang ko?”**
>
> **“Sino ang babayaran ko?”**

The first version only needs:

```text
AUTH
  ↓
GROUP
  ↓
EXPENSE
  ↓
BALANCE
  ↓
REMINDER
  ↓
SETTLEMENT
```

If this flow is fast, accurate, and pleasant, the MVP is successful.

---

# 29. First Claude Code Prompt

Paste this into Claude Code after placing this file in the repository:

```text
Read MVP_PLAN.md completely before making changes.

You are the lead engineer for HATI, a Filipino-first expense splitting mobile app.

Your job is to implement the MVP exactly according to MVP_PLAN.md.

Start with TASK 001 only.

Before coding:
1. Inspect the repository.
2. Check whether an app already exists.
3. Check package.json and installed dependencies.
4. Check existing source files.
5. Check whether Supabase is already configured.
6. Do not delete or rewrite working code without a reason.

For TASK 001:
- Set up/verify the Expo + React Native + TypeScript foundation.
- Set up Expo Router.
- Establish the project structure described in MVP_PLAN.md.
- Add only necessary dependencies.
- Create a basic navigation shell.
- Create a simple HATI launch/home placeholder.
- Configure linting/formatting/testing if not already present.

Then:
- Run TypeScript checks.
- Run lint.
- Run tests.
- Fix all errors.

Do not implement later tasks yet.

When finished, report:
1. Files created/changed
2. Dependencies added
3. Commands run
4. Test results
5. Any blockers
6. What TASK 002 will implement

Do not claim something works unless you actually verified it.
```

---

# 30. Next Claude Code Prompts

After TASK 001 is verified, use:

```text
Continue with TASK 002 from MVP_PLAN.md.

Inspect the current implementation first. Do not repeat completed work.

Implement only Supabase configuration and connection verification.

Follow all security requirements in MVP_PLAN.md.

Run typecheck, lint, and tests before finishing.
```

Then:

```text
Continue with TASK 003 from MVP_PLAN.md.

Implement the PostgreSQL/Supabase database migrations for profiles, groups, group_members, expenses, expense_splits, and settlements.

Add appropriate constraints, indexes, timestamps, foreign keys, and safe deletion behavior.

Do not build UI yet.

Run migrations/checks and verify the schema.
```

Then:

```text
Continue with TASK 004 from MVP_PLAN.md.

Implement and test Supabase Row Level Security policies.

Security is a hard requirement.

Verify that users can only access data belonging to groups they are members of and cannot modify unauthorized records.

Do not weaken RLS simply to make frontend development easier.
```

Continue sequentially through TASK 021.

---

# END OF MVP PLAN
