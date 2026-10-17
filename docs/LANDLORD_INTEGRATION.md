# Landlord frontend integration verification

Branch: `merge/landlord-frontend-notifications`. Main's documentation updates were merged normally; PR #30 and Matthew's Notifications changes were already ancestors and were not merged again.

## Behavior

- Both roles use the existing shared bottom navbar with the landlord design. Landlord has Home/History/Settings; tenant retains Home/Inspections/History/Settings. React Navigation retains nested-stack and selected-tab behavior.
- Header supports titles, subtitles, back callbacks, the original SVG NotificationBell, right actions, and optional top safe area. Parents already owning safe areas do not add another inset. Landlord screens, relevant tenant headings, Notifications, Settings, Login, Register, and Forgot Password reuse it. The splash, email confirmation, and inspection completion layouts stay specialized.
- Both dashboard bells open the shared typed Notifications route and return to their originating role. Today/Earlier grouping and local Mark All as Read remain. Cards are noninteractive and expose read state to accessibility.
- Both roles use the shared Settings tab root without an invalid Back action. Logout still uses AuthContext/useAuthRequest with pending/error/retry handling. Unsupported settings rows are explicitly unavailable. Switches are accessible and explicitly local, not persisted.
- Notifications and Settings use ScreenContainer's 480-point maximum width and landlord padding, heading sizes, colors, and card proportions. No zoom transforms or font-scaling suppression were introduced.
- Landlord greeting uses the authenticated name with email/role fallback. Typed property records and statistics live in landlordMockData.ts and are explicitly sample data. Manage Unit Details is disabled.
- Property preview requires address/unit, nonnegative whole bedrooms, half-step bathrooms, and tenant email only when assignment is enabled. Valid submission previews without claiming to save or assign anything; Cancel returns to Dashboard.
- Inspection preview accepts strict YYYY-MM-DD calendar dates from today onward and requires remote areas. Neither option schedules anything or sends notifications.
- Inspection decisions give distinct demo feedback. Photos/findings are marked placeholders/examples. Open Unit History selects the existing History tab; dashboard/back behavior is retained. Decision buttons wrap on narrow layouts. UnitChip is read-only without a handler.

## Checks actually run

- Baseline: TypeScript passed; lint had one navbar warning; 37/40 frontend tests passed, with three existing logout-label failures.
- `npm ci --offline --no-audit --no-fund`: passed using the lockfile; no dependency versions upgraded.
- TypeScript (`tsc --noEmit`): passed.
- `npm run lint`: passed without warnings.
- `npm test -- --ci --runInBand`: 5 suites, 79 tests passed. Includes existing tenant/auth regressions plus LandlordFlow.test.tsx.
- Django `manage.py check`: no issues.
- Django `manage.py makemigrations --check --dry-run`: no changes detected.
- Django `manage.py test`: 24 tests passed.
- iOS Debug simulator build: BUILD SUCCEEDED using frontend.xcworkspace/frontend, iPhone 18 Pro Max, ONLY_ACTIVE_ARCH=YES, CODE_SIGNING_ALLOWED=NO, derived data /private/tmp/leaseguard-landlord-build.
- Native smoke tests on iPhone 18 Pro Max and iPhone 18 Pro, iOS 27.0: both sessions restored; landlord dashboard, Notifications/read state/back, Settings, AI results/History/back; tenant four-tab navigation, inspection tab, Notifications/back, and Settings verified. Header/card typography and layout inspected visually. Existing sessions were retained. A disposable registration fixture was removed after verification.
- Android build/device test not run: adb/device tooling was not available. Cross-platform navigation and component behavior is covered by Jest, but this is not an Android native verification claim.
- Whitespace/diff checks passed. Existing uncommitted Podfile.lock, project.pbxproj and PrivacyInfo.xcprivacy changes were preserved and excluded from integration commits. The successful local native build used those existing local native files.

## Prototype boundaries and remaining review

Property submission, inspection scheduling, AI decisions/history/photos, notification content/read state, and notification preferences are prototype-only. No property APIs, AI service, push delivery, notification persistence, or preference synchronization were added. Unsupported settings destinations remain unavailable. Django models, migrations, auth logic/endpoints, database configuration, CI workflows, and Android configuration were not changed.

Ready for frontend PR review into main, with prototype boundaries and Android native verification explicitly outstanding. No PR was created and main was not modified.

## Frontend files changed since the pushed navbar baseline

- `frontend/__tests__/LandlordFlow.test.tsx`
- `frontend/src/components/BottomNavigation.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/UnitChip.tsx`
- `frontend/src/data/landlordMockData.ts`
- `frontend/src/navigation/TenantNavigator.tsx`
- `frontend/src/navigation/TenantTabs.tsx`
- `frontend/src/navigation/types.ts`
- `frontend/src/screens/auth/ForgotPasswordScreen.tsx`
- `frontend/src/screens/auth/LoginScreen.tsx`
- `frontend/src/screens/auth/RegisterScreen.tsx`
- `frontend/src/screens/landlord/AIInspectionReviewScreen.tsx`
- `frontend/src/screens/landlord/AddPropertyScreen.tsx`
- `frontend/src/screens/landlord/ConditionHistoryScreen.tsx`
- `frontend/src/screens/landlord/LandlordDashboardScreen.tsx`
- `frontend/src/screens/landlord/ScheduleInspectionScreen.tsx`
- `frontend/src/screens/shared/NotificationsScreen.tsx`
- `frontend/src/screens/shared/SettingsScreen.tsx`
- `frontend/src/screens/tenant/GuidedInspectionScreen.tsx`
- `frontend/src/screens/tenant/InspectionAvailabilityScreen.tsx`
- `frontend/src/screens/tenant/MaintenanceDetailScreen.tsx`
- `frontend/src/screens/tenant/ReportMaintenanceScreen.tsx`
- `frontend/src/screens/tenant/ReviewInspectionPhotoScreen.tsx`
- `frontend/src/screens/tenant/TenantDashboardScreen.tsx`
- `frontend/src/screens/tenant/UnitHistoryScreen.tsx`
- `frontend/src/utils/landlordValidation.ts`
