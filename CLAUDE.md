# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start dev server (use --tunnel for iPhone on different network)
npx expo start --ios    # Start and open iOS simulator
npx expo start --android
npm run lint            # ESLint
```

**Builds (EAS):**
```bash
eas build --profile development --platform ios   # Dev client build (required for physical device)
eas build --profile preview --platform ios       # Internal distribution build
eas build --profile production --platform all
```

> Expo Go cannot run this app — `developmentClient: true` and `newArchEnabled: true` require a custom dev client build.

## Architecture Overview

**Paisa-v5** is a personal finance tracking app (income/expense/wallet management) built with Expo 54, React Native 0.81, and Firebase as the sole backend.

### Key Layers

**Routing** — Expo Router (file-based), three route groups:
- `app/(auth)/` — Onboarding, login, register (unauthenticated)
- `app/(tabs)/` — Main app: home dashboard, statistics, wallet list, profile
- `app/(modals)/` — Overlay screens pushed as modals over tabs

Auth routing is handled inside `contexts/authContext.tsx`: Firebase auth state changes trigger navigation to `/(auth)/welcome` or `/(tabs)`.

**State Management** — No Redux/Zustand. Two mechanisms:
1. `contexts/authContext.tsx` — user auth state + login/register/updateUserData methods
2. `hooks/useFetchData.ts` — generic Firestore `onSnapshot` hook for real-time collection subscriptions

**Services** — All business logic lives here, not in components:
- `services/transactionService.ts` — CRUD + wallet balance reconciliation (the most complex file; handles reverting old wallet amounts when editing a transaction)
- `services/walletService.ts` — wallet CRUD + cascade-deletes transactions
- `services/userService.ts` — profile updates + full account deletion
- `services/imageService.ts` — Cloudinary upload utility

**Firestore Schema:**
```
/users/{uid}               # User doc (name, email, image, createdAt)
/users/{uid}/wallets/{id}  # amount, totalIncome, totalExpenses, name, image
/users/{uid}/transactions/{id}  # type (income|expense), amount, walletId, category, date, description, image
```

### Styling & Constants
- `constants/theme.ts` — single source of truth for colors, spacing, radius
- `utils/styling.ts` — responsive scaling helpers (`scale`, `verticalScale`, `moderateScale`)
- All components use inline StyleSheet with theme constants — no CSS-in-JS or Tailwind

### Environment
The app uses `EXPO_PUBLIC_*` env vars for Firebase and Cloudinary config. A `.env` file is required at the root (not committed). Variables needed: Firebase project config + Cloudinary cloud name and upload preset.

### TypeScript
Path alias `@/*` maps to the project root. Key shared types are in `types.ts` — `UserType`, `WalletType`, `TransactionType`, `ResponseType`.
