# VOICE ACTIVATION MODE & APP-SPECIFIC RULES - IMPLEMENTATION PLAN

## COMPLETED WORK ✅

### Foundation Architecture
- [x] Extended type system with `AppRule`, `VoiceActivationConfig`, and `SHORTCUT_OPTIONS`
- [x] Enhanced state management for voice activation and active application tracking
- [x] Created application detection system (`src/main/app-detector.ts`)
- [x] Implemented voice activation system (`src/main/voice-activation.ts`)
- [x] Updated keyboard integration with app-specific rule support
- [x] Added comprehensive IPC endpoints

## IMMEDIATE FIXES NEEDED 🔧

### Phase 1: Resolve TypeScript Compilation Errors
**Priority: CRITICAL**

1. **Fix Import/Export Issues**
   - Ensure all functions are properly exported from modules
   - Fix import statements in `src/main/index.ts`, `src/main/keyboard.ts`, `src/main/tipc.ts`

2. **Update Default Configuration**
   - Add default values for voice activation and app rules in config store
   - Initialize empty arrays and default settings

3. **Test Basic Compilation**
   - Run `pnpm run typecheck` until clean
   - Test basic app startup

## PHASE 2: UI IMPLEMENTATION 🎨

### 2.1 Voice Activation Settings Page
**Location**: `src/renderer/src/pages/settings-voice-activation.tsx`

**Features**:
- Enable/disable voice activation toggle
- Sensitivity slider with real-time audio level indicator
- Silence threshold configuration
- Min/max recording duration settings
- Test voice activation button
- Visual feedback for voice detection

### 2.2 App-Specific Rules Management Page
**Location**: `src/renderer/src/pages/settings-app-rules.tsx`

**Features**:
- List of existing app rules with enable/disable toggles
- Add new rule wizard with:
  - Application name pattern input
  - Executable pattern input (optional)
  - Shortcut mode selection (hold-ctrl, ctrl-slash, voice-activation, disabled)
  - STT provider override
  - Post-processing settings override
  - Priority setting
- Edit existing rules
- Delete rules with confirmation
- Test rule matching against current application
- Import/export rules functionality

### 2.3 Enhanced General Settings
**Update**: `src/renderer/src/pages/settings-general.tsx`

**Changes**:
- Add global "Enable App-Specific Rules" toggle
- Add voice activation option to shortcut dropdown
- Show current active rule indicator
- Link to dedicated voice activation settings

### 2.4 Status Indicators
**Locations**: Various UI components

**Features**:
- Tray icon updates for voice activation mode
- Panel window voice level indicator
- Active rule indicator in main window
- Voice activation status in settings

## PHASE 3: TESTING & VALIDATION 🧪

### 3.1 Voice Activation Testing
- [ ] Test microphone access permissions
- [ ] Validate voice detection sensitivity
- [ ] Test silence detection accuracy
- [ ] Verify recording duration limits
- [ ] Test voice activation in different apps

### 3.2 App Detection Testing
- [ ] Test Windows PowerShell app detection
- [ ] Test macOS AppleScript app detection
- [ ] Validate pattern matching accuracy
- [ ] Test rule priority resolution
- [ ] Test configuration merging

### 3.3 Integration Testing
- [ ] Test switching between different apps
- [ ] Verify shortcut mode changes work correctly
- [ ] Test voice activation enable/disable
- [ ] Validate recording workflow with app rules

## PHASE 4: POLISH & OPTIMIZATION 🌟

### 4.1 Error Handling
- Add graceful fallbacks for app detection failures
- Handle microphone permission denials
- Add error recovery for voice activation failures
- Implement retry mechanisms

### 4.2 Performance Optimization
- Optimize app detection polling frequency
- Minimize voice activation resource usage
- Cache app detection results
- Debounce configuration updates

### 4.3 User Experience Enhancements
- Add rule creation templates for popular apps
- Implement smart rule suggestions
- Add voice activation calibration wizard
- Create app rule export/import functionality

## IMPLEMENTATION PRIORITY

### HIGH PRIORITY (Complete First)
1. Fix TypeScript compilation errors
2. Implement voice activation settings UI
3. Create basic app rules management UI
4. Test core functionality

### MEDIUM PRIORITY (Second Phase)
1. Advanced app rule features
2. Polish UI/UX
3. Comprehensive testing
4. Error handling improvements

### LOW PRIORITY (Future Enhancements)
1. Rule templates and suggestions
2. Advanced voice activation features
3. Analytics and usage tracking
4. Integration with external services

## ESTIMATED TIMELINE

- **Phase 1 (Fixes)**: 1-2 hours
- **Phase 2 (UI)**: 4-6 hours
- **Phase 3 (Testing)**: 2-3 hours
- **Phase 4 (Polish)**: 3-4 hours

**Total Estimated Time**: 10-15 hours for complete implementation

## TECHNICAL NOTES

### Voice Activation Architecture
- Uses hidden renderer window for Web Audio API access
- Main process coordinates voice detection events
- Configurable sensitivity and timing parameters
- Integrates with existing recording workflow

### App Detection Architecture
- Platform-specific implementations (Windows/macOS)
- Polling-based with configurable intervals
- Rule-based matching with priority system
- Configuration merging for effective settings

### Integration Points
- Keyboard event handler respects app rules
- Configuration system extended for new features
- IPC communication for UI interactions
- State management for real-time updates

---

**Next Action**: Fix TypeScript compilation errors and proceed with UI implementation.
