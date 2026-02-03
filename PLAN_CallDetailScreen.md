# Kế hoạch Refactor CallDetailScreen

## Tham khảo từ RecordingsScreen (Mixer Tab)

### 1. Cấu trúc hiện tại của RecordingsScreen
- Sử dụng theme system: `Colors, Spacing, FontSize, BorderRadius`
- Sử dụng `react-native-video` cho audio playback thực tế
- Sử dụng `whisper.rn` cho speech-to-text
- Layout dạng sections với cards
- Component con tái sử dụng: `AudioTrackPlayer`

---

## Kế hoạch Refactor CallDetailScreen

### Phase 1: Chuẩn hóa Theme & Styles
**Tasks:**
- [ ] Import theme từ `../theme/colors` thay vì hardcode màu
- [ ] Sử dụng `Colors`, `Spacing`, `FontSize`, `BorderRadius` nhất quán
- [ ] Xóa SVG icons inline, tạo file riêng `/src/components/icons/`

### Phase 2: Tách Components
**Tasks:**
- [ ] Tạo `CallInfoCard` component - hiển thị thông tin liên hệ
- [ ] Tạo `CallInfoGrid` component - grid 6 items thông tin cuộc gọi
- [ ] Tạo `AudioPlayer` component - player phát lại ghi âm (tái sử dụng được)
- [ ] Export tất cả từ `/src/components/index.js`

### Phase 3: Tích hợp Audio Playback thực tế
**Tasks:**
- [ ] Sử dụng `react-native-video` thay vì simulate playback
- [ ] Hỗ trợ phát audio từ file path hoặc URL
- [ ] Thêm seek functionality (kéo thanh progress)
- [ ] Lưu/load recording từ storage

### Phase 4: Tích hợp Whisper Transcription (Optional)
**Tasks:**
- [ ] Tái sử dụng Whisper context từ RecordingsScreen
- [ ] Thêm nút "Transcribe" để chuyển ghi âm thành text
- [ ] Hiển thị kết quả transcription bên dưới player

---

## Chi tiết Implementation

### File Structure mới:
```
src/
├── components/
│   ├── index.js
│   ├── icons/
│   │   ├── index.js
│   │   ├── ChevronLeft.js
│   │   ├── PhoneCall.js
│   │   ├── HourglassIcon.js
│   │   └── ... (các icons khác)
│   ├── CallInfoCard.js
│   ├── CallInfoGrid.js
│   └── AudioPlayer.js
├── screens/
│   ├── CallDetailScreen.js (refactored)
│   └── ...
```

### CallInfoCard Component:
```jsx
// Props: contactName, phoneNumber, onCallPress
// Layout: Avatar + Info + Call button
```

### CallInfoGrid Component:
```jsx
// Props: callData = { duration, ringTime, date, direction, agent, agentPhone }
// Layout: 2 columns x 3 rows grid
```

### AudioPlayer Component:
```jsx
// Props:
//   - audioSource (file path or URL)
//   - duration
//   - onTranscribe (optional callback)
//   - showTranscribe (boolean)
// Features:
//   - Play/Pause
//   - Skip ±10s
//   - Progress bar with seek
//   - Time display
```

---

## Thứ tự thực hiện

1. **Bước 1**: Tạo folder `src/components/icons/` và move SVG icons
2. **Bước 2**: Refactor CallDetailScreen dùng theme colors
3. **Bước 3**: Tạo `CallInfoCard` component
4. **Bước 4**: Tạo `CallInfoGrid` component
5. **Bước 5**: Tạo `AudioPlayer` component với react-native-video
6. **Bước 6**: Update CallDetailScreen sử dụng components mới
7. **Bước 7**: Test và fix bugs
8. **Bước 8**: (Optional) Tích hợp Whisper transcription

---

## Model Data

```javascript
// Call Detail Data Model
const CallDetailData = {
  // Contact info
  contactName: string,      // "不明" hoặc tên liên hệ
  phoneNumber: string,      // "01084384629704"

  // Call info
  duration: number,         // seconds - 46
  ringTime: number,         // seconds - 8
  date: string,             // "2025年10月2日"
  direction: string,        // "発信" (outgoing) / "着信" (incoming)
  agent: string,            // "InfiniGuest002"
  agentPhone: string,       // "05036116648"

  // Recording
  recordingUrl: string,     // URL or file path to audio
  recordingDuration: number,// seconds

  // Transcription (optional)
  transcription: string,    // Text result from Whisper
};
```

---

## Estimated Effort

| Task | Complexity | Time |
|------|------------|------|
| Icons extraction | Low | 15 min |
| Theme refactor | Low | 15 min |
| CallInfoCard | Medium | 20 min |
| CallInfoGrid | Medium | 20 min |
| AudioPlayer | High | 45 min |
| Integration | Medium | 30 min |
| Testing | Medium | 20 min |
| **Total** | | **~2.5 hours** |
