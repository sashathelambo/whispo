# Compact Status Bar Specification & Acceptance Criteria

## Overview
This document defines the exact requirements for the new compact status bar implementation, including dimensions, UI elements, and behavior specifications for development and QA validation.

## ✅ Fixed Dimensions
- **Width**: 160px (fixed, no dynamic resizing)
- **Height**: 16px (fixed, no dynamic resizing)
- **Border Radius**: 6px (rounded-lg)
- **No expansion/collapse functionality** - maintains compact size at all times

## ✅ Removed Elements
- ❌ **Minimize/expand arrows** - Completely removed
- ❌ **Expand to full-size interface** - No longer available
- ❌ **Separate voice activation popup** - Integrated into context menu
- ❌ **Dynamic width adjustments** - Fixed width only

## ✅ Retained UI Elements (Priority Order)

### 1. Status Indicator Dot ✅
- **Size**: 1.5px × 1.5px
- **States**:
  - Recording: Red (`bg-red-500`) with pulse animation
  - Voice Listening: Green (`bg-green-400`) with pulse animation  
  - Voice Ready: Blue (`bg-blue-400`) solid
  - Hold Key Mode: Purple (`bg-purple-400`) solid
  - Ctrl+/ Mode: Orange (`bg-orange-400`) solid
  - Default/Ready: Gray (`bg-gray-400`) solid

### 2. 3-Letter Status Text ✅
- **Font Size**: 10px
- **Max Characters**: 3-4 characters with truncation
- **States**:
  - `REC` - During recording (any mode)
  - `LIVE` - Voice activation listening
  - `VOICE` - Voice activation ready
  - `HOLD` - Hold key mode ready
  - `CTRL` - Ctrl+/ shortcut mode
  - `READY` - Default ready state
  - `⚡` - Processing transcription
  - `✓` - Successfully completed
  - `❌` - Error state

### 3. 2-Digit Timer ✅
- **Font Size**: 9px
- **Format**: `15s` (seconds only)
- **Visibility**: Only during active recording
- **Color**: Red (`text-red-300`) with pulse animation
- **Font**: Monospace (`font-mono`)

### 4. Processing Spinner ✅
- **Size**: 2px × 2px
- **Visibility**: Only during transcription processing
- **Replaces other indicators when active

### 5. Ultra Compact Audio Visualizers ✅

#### Voice Level Meter (Voice Activation Mode)
- **Bars**: 3 bars maximum
- **Size**: 0.5px width × 1px height per bar
- **Visibility**: Only during voice listening (not recording)
- **Colors**: 
  - Active: Green (`bg-green-300`)
  - Inactive: Gray (`bg-gray-600`)
- **Threshold**: Based on `audioLevel * 3`

#### Recording Visualizer
- **Bars**: 4 bars maximum (reduced from 40)
- **Size**: 0.5px width × 1-6px height (dynamic)
- **Visibility**: Only during active recording
- **Colors**: Gradient from green to blue (`from-green-400 to-blue-400`)
- **Animation**: 100ms transition duration

## ✅ Integrated Voice Menu

### Context Menu Trigger
- **Activation**: Right-click on status bar
- **Auto-hide**: 3 seconds after opening
- **Position**: Below status bar with 1px margin

### Menu Items
1. **Voice Activation Controls** (when in voice mode):
   - `🎤 Start Voice` / `⏸ Stop Voice` - Toggle voice listening
   - Separator line

2. **Recording Control**:
   - `🔴 Record` / `⏹ Stop Record` - Manual recording toggle

3. **Settings**:
   - `⚙️ Settings` - Open settings (placeholder for future implementation)

### Menu Styling
- Background: `bg-black/90` with backdrop blur
- Border: `border-white/20`
- Text: 12px white/80% opacity
- Hover: `bg-white/10`
- Minimum width: 128px

## ✅ Background & Border States

### Color Coding
- **Recording**: `bg-red-500/20 border-red-500/30`
- **Voice Listening**: `bg-green-500/20 border-green-500/30`  
- **Voice Ready**: `bg-blue-500/20 border-blue-500/30`
- **Default**: `bg-black/30 border-white/10`

### Visual Effects
- Backdrop blur: `backdrop-blur-sm`
- Transition: `duration-200` for smooth state changes
- Border width: 1px on all sides

## ✅ Layout & Spacing

### Container
- **Display**: Flex with `items-center`
- **Padding**: `px-1.5 py-0.5` (6px horizontal, 2px vertical)
- **Gap**: `gap-1` (4px between elements)

### Element Positioning
- All elements use `flex-shrink-0` to prevent compression
- Status text uses `truncate` for overflow handling
- Elements appear in order: Dot → Text → Timer → Visualizer → Spinner

## ✅ Interaction Behavior

### Click Actions
- **Left Click**: Start/stop recording
- **Right Click**: Show context menu
- **No Double-click**: Single click interaction only

### State Management
- **No persistent expansion** - always returns to compact view
- **Context menu timeout** - Auto-hide after 3 seconds
- **Smooth transitions** - 200ms duration for state changes

## 🔧 Technical Implementation Notes

### Dependencies
- Removed `Button` component import (no longer needed)
- Reduced `VISUALIZER_BUFFER_LENGTH` from 40 to 4
- Removed `isExpanded` and `isActivated` state variables

### Performance
- Fixed dimensions eliminate dynamic resizing calculations
- Reduced visualizer data processing (4 vs 40 data points)
- Simplified state management with fewer UI states

### Accessibility
- Maintains cursor pointer for interactive elements
- Context menu provides keyboard-friendly alternatives
- Status text provides screen reader friendly state information

## ✅ Acceptance Test Cases

### 1. Dimension Validation
- [ ] Status bar width is exactly 160px
- [ ] Status bar height is exactly 16px  
- [ ] No dynamic resizing occurs during any state changes

### 2. UI Element Presence
- [ ] Status indicator dot visible in all states
- [ ] Status text shows correct 3-letter codes
- [ ] Timer appears only during recording
- [ ] Voice level meter shows only during voice listening
- [ ] Recording visualizer shows only during recording
- [ ] Processing spinner shows only during transcription

### 3. Context Menu Integration
- [ ] Right-click opens context menu
- [ ] Menu shows voice controls when in voice mode
- [ ] Menu always shows record and settings options
- [ ] Menu auto-hides after 3 seconds
- [ ] Menu actions trigger correct behaviors

### 4. Removed Elements Validation
- [ ] No minimize/expand arrows present
- [ ] No expansion to larger interface available
- [ ] No separate voice activation popup windows
- [ ] No dynamic width changes based on content

### 5. State Color Validation
- [ ] Recording state shows red background/border
- [ ] Voice listening shows green background/border
- [ ] Voice ready shows blue background/border
- [ ] Default state shows black/gray background/border

## 📋 QA Checklist

- [ ] All dimensions match specification exactly
- [ ] All removed elements are confirmed absent
- [ ] All retained elements function as specified
- [ ] Context menu replaces separate voice popup
- [ ] Color states match specification
- [ ] Text truncation works correctly
- [ ] Animations perform smoothly
- [ ] No layout shifts during state changes
- [ ] Right-click context menu works reliably
- [ ] Voice activation integration functions properly

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-19  
**Implementation Status**: ✅ Complete

