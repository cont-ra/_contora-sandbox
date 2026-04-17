# KH VFX Tracker — Changelog

## Session 2026-04-04 / 2026-04-05

### v6.0 — Version Switcher Panel
- Added versions panel (left of video) for switching source/versions inline
- Player container fixed size (`object-fit:contain`), no resize on video switch
- Per-version drawings storage (`version.drawings` separate from source)
- Timeline markers from notes only (no cross-contamination between versions)
- Markers clickable with hover grow effect, exact frame positioning using scrubber formula
- Seamless video switching without layout collapse

### v6.1 — Draw Toolbar Cleanup
- Draw tools hidden until Draw button clicked
- Draw button anchored to top-left of video (above frame, not inside)
- Toolbar restructured: Draw button stays fixed, tools expand right

### v6.2 — Priority Column
- Priority column with color dropdown (red/yellow/green traffic light)
- Row background tinting by priority color
- Sort by priority (red on top, green on bottom) — toggle via ⚑ header
- Priority editable only by admin and client

### v6.3 — Admin Menu & User Management
- Admin gear ⚙ button in header (right edge, admin only)
- Manage Users modal: add/remove users, generate auth keys
- Dynamic users stored in `state.__users`, synced via Supabase
- User color picker — 20 colors, click dot to change, persisted

### v6.4 — Full User Management
- All accounts visible (admin/artist/client) with role switching dropdown
- Key display with click-to-copy
- Key regeneration 🔄 per user
- Admin role locked (no dropdown)
- New users always created as artist
- Card-based layout with Password/Reset/Login Link buttons

### v6.5 — User Colors in Table
- User colors from color picker applied to Artist column in main table
- Color picker fix: reopens correctly on multiple clicks

### v6.6 — Player Navigation
- Arrow Up/Down in player navigates to prev/next shot (with video)
- Shot name label above player in bold blue (preserves underscores)
- Sort arrows ▲/▼ on ID, TC In, TC Out columns only

### v6.7 — Shot Info Column
- Replaced Description column with Shot Info
- Fields: Camera, Sensor Mode, Lens, Focal Length, T-Stop, Focus Distance, Filters, Resolution, Aspect Ratio, FPS, Shutter, Color Space, Gamma, Bit Depth, Codec, LUT/IDT
- Searchable dropdowns for all fields with 300+ presets
- Camera-linked sensor modes (50+ cameras with specific sensor mode options)
- Inline editing modal with sections: Camera & Optics, Format, Color Pipeline

### v6.8 — Shot Info Database
- Massive expansion: 120+ cameras, 50+ sensors, 150+ lenses, 50+ color spaces, 55+ gamma curves
- All major manufacturers: ARRI, RED, Sony, Canon, Blackmagic, Panasonic, Nikon, Fujifilm, Kinefinity, Z CAM, DJI, GoPro, Phantom, Panavision, vintage film cameras
- Lens sets: Cooke, Zeiss, Leica, Angenieux, Fujinon, Hawk, Kowa, LOMO, Atlas, DZOFilm, Laowa
- Added: FPS, Resolution, Aspect Ratio, Shutter Angle, Codec (RAW/ProRes/H.264/EXR/DPX), Bit Depth, LUT/IDT, Focal Length, T-Stop, Focus Distance, Filters (ND/diffusion/polarizer/color)

### v6.9 — Shot Info Preview & Tooltip
- 3-column grid preview in table (Camera/Lens/Focal, Resolution/FPS/Shutter, ColorSpace/Gamma/BitDepth)
- Labels above values (grey label, white value)
- Hover tooltip: translucent floating window with blur, follows cursor with smooth lerp animation
- Click to pin tooltip (opaque, copyable, edit button for admin)
- Tooltip sections: Camera & Optics, Format, Color Pipeline
- Viewport clamping (40px margins from edges)

### v6.10 — Camera-Linked Sensor Modes
- 50+ cameras mapped to specific sensor modes with dimensions
- Dynamic dropdown: select camera → sensor shows only relevant modes
- Covers ARRI, RED, Sony, Canon, Blackmagic, Panasonic, DJI, Kinefinity, Z CAM, Phantom

### v6.11 — Table Layout Improvements
- ID and Preview merged into one column
- Thumbnail fills column width (280px), auto height by aspect ratio
- Shot info aligned to thumbnail top edge
- Larger ID label (15px bold blue, 8px gap to thumbnail)
- Bottom padding on preview cell
- Soft zoom on thumbnail hover (2.5%, 0.3s ease)

### v6.12 — Admin Column Visibility
- Admin column visible only for admin users
- Row gaps between table rows (4px dark separator)

### v6.13 — Video Preview on Hover
- Hovering thumbnail starts video playback (muted, loop)
- Thumbnail stays visible until video buffered (canplay event)
- Fade-in transition (0.3s opacity)
- Video removed on mouse leave

### v6.14 — KH_01_328 Source Upload
- Video and thumbnail uploaded to R2
- Added to GIFS set
- Timecodes: 1:16:03:15 → 1:16:05:22

### v6.15 — Player Notes in Chat
- Player notes (source + all versions) synced into artist chat
- Sorted by timestamp, displayed with green accent border
- Read-only in chat (no edit/delete/reply)
- Clickable timecodes — opens player at correct version and frame

### v6.16 — Chat Preview
- Chat preview in main table shows last 8 messages as mini bubbles
- Bubble styles match chat (admin red right, artist blue left, notes green left)
- Fade to transparent at top
- Messages aligned bottom-up
- Player notes included in preview with green timecodes

### v6.17 — Unread Indicator
- Yellow border on chat preview when unread messages exist
- Grey border when all read
- Per-user tracking via `state.__readState[userId][shotId]`
- Auto mark read on chat open
- ReadState preserved during remote sync (merge, not overwrite)

### v6.18 — Message Management
- Admin double-delete: first click soft-deletes, second click permanently removes
- Red ✕ button visible on soft-deleted messages for admin
- Chat image support: file attach 📎, clipboard paste (Ctrl/Cmd+V)
- Images uploaded to R2 (`chat/SHOT_ID/img_timestamp.ext`)
- Inline display in chat, click opens full size

### v6.19 — Chat Images
- 📎 button for file selection
- Paste from clipboard (screenshot support like Telegram)
- Preview before send with cancel button
- Images stored in R2, displayed inline in chat

### v6.20 — Magic Auth Links
- Per-user auth tokens (`linkToken`) for URL-based login
- Format: `ADMIN_eEcF_ADMIN_A53p_ADMIN_xxxx_ADMIN` (username caps + token chunks)
- Auto-login via `?auth=` URL parameter
- Token revoked on key regeneration (old links stop working)
- 🔗 Login Link button in Manage Users

### v6.21 — Manage Users Redesign
- Card-based layout per user
- Clear buttons: Password (click-to-copy), 🔄 Reset, 🔗 Login Link
- Green "Copied!" feedback on click
- Color dot with picker in each card

### v6.22 — Cloudflare Worker
- Worker deployed at `killhouse-vfx.contora.workers.dev`
- Dynamic OG previews for Telegram: personalized title "LOGIN AS ADMIN/NIKITA/etc"
- Per-user preview images uploaded to R2 (`og/admin.png`, `og/nikita.png`, etc)
- Bot detection: Telegram/WhatsApp/Slack/Discord get OG HTML, users get 302 redirect
- Auth links routed through Worker for rich previews
