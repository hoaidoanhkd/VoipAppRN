import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import Svg, {
  Path,
  Polyline,
  Line,
  Rect,
  Circle,
  Polygon,
} from 'react-native-svg';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { initWhisper } from 'whisper.rn';

// Whisper Model URL - Using base model for balance between size and accuracy
// tiny: 75MB, ~1GB RAM (fastest, lowest accuracy)
// base: 142MB, ~1GB RAM (good balance) ← recommended for mobile
// small: 465MB, ~2GB RAM (better accuracy but may fail on low-memory devices)
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_FILENAME = 'ggml-base.bin';
const MODEL_EXPECTED_SIZE = 147951465; // ~142MB for base model

// Lazy transcription settings
const INITIAL_SECONDS = 15; // Transcribe first 15 seconds initially
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const NUM_CHANNELS = 1;


// Audio files
const AUDIO_FILES = {
  personA: {
    name: 'オペレーター',
    source: require('../assets/audio/person_a_final.wav'),
    color: '#1976D2',
  },
  personB: {
    name: 'お客様',
    source: require('../assets/audio/person_b_final.wav'),
    color: '#C2185B',
  },
  // Trimmed version of personB (silence removed) for better transcription
  personBTrimmed: {
    name: 'お客様',
    source: require('../assets/audio/person_b_trimmed.wav'),
    color: '#C2185B',
  },
  merged: {
    name: '通話録音',
    source: require('../assets/audio/merged_conversation.wav'),
    color: '#1a7a6d',
  },
  stereo: {
    name: '通話録音 (Stereo)',
    source: require('../assets/audio/stereo_conversation.wav'),
    color: '#1a7a6d',
  },
};

// Time offset for personB (silence trimmed from beginning)
const PERSON_B_OFFSET = 7.0; // seconds

// SVG Icons
const ChevronLeft = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="15 18 9 12 15 6" />
  </Svg>
);

const PhoneCall = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

const HourglassIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 22h14" />
    <Path d="M5 2h14" />
    <Path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
    <Path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </Svg>
);

const BellIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

const CalendarIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
    <Line x1={16} y1={2} x2={16} y2={6} />
    <Line x1={8} y1={2} x2={8} y2={6} />
    <Line x1={3} y1={10} x2={21} y2={10} />
  </Svg>
);

const ArrowUpDown = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1={12} y1={3} x2={12} y2={21} />
    <Polyline points="8 7 12 3 16 7" />
    <Polyline points="16 17 12 21 8 17" />
  </Svg>
);

const UserIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4} />
    <Path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
  </Svg>
);

const PhoneIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

const VolumeIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </Svg>
);

const WaveformIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1a7a6d" strokeWidth={2.5} strokeLinecap="round">
    <Line x1={4} y1={8} x2={4} y2={16} />
    <Line x1={8} y1={5} x2={8} y2={19} />
    <Line x1={12} y1={9} x2={12} y2={15} />
    <Line x1={16} y1={6} x2={16} y2={18} />
    <Line x1={20} y1={10} x2={20} y2={14} />
  </Svg>
);

const PlayIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="#333" stroke="none">
    <Polygon points="6,3 20,12 6,21" />
  </Svg>
);

const PauseIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="#333" stroke="none">
    <Rect x={5} y={3} width={5} height={18} rx={1} />
    <Rect x={14} y={3} width={5} height={18} rx={1} />
  </Svg>
);

const Replay10 = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6" />
  </Svg>
);

const Forward10 = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6" />
  </Svg>
);

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

const CallDetailScreen = ({ callData = {}, onBack, singleSpeaker = false }) => {
  // Audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTrack, setActiveTrack] = useState('merged');
  const playerRef = useRef(null);

  // Whisper states
  // Use useRef to prevent context loss on re-renders (best practice)
  const whisperContextRef = useRef(null);
  const isMountedRef = useRef(true); // Track if component is mounted
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState('');

  // Transcription states (lazy load - transcribe on demand)
  const [conversation, setConversation] = useState([]);
  const [isInitialOnly, setIsInitialOnly] = useState(true); // true = only first 15s transcribed
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Default data
  const data = {
    contactName: '不明',
    phoneNumber: '01084384629704',
    duration: 46,
    ringTime: 8,
    date: '2025年10月2日',
    direction: '発信',
    agent: 'InfiniGuest002',
    agentPhone: '05036116648',
    ...(callData && typeof callData === 'object' && !callData.nativeEvent ? callData : {}),
  };

  // Use actual audio duration if available, otherwise use default
  const displayDuration = duration > 0 ? Math.round(duration) : data.duration;

  const callInfo = [
    { icon: <HourglassIcon />, label: '通話時間', value: `${displayDuration}秒` },
    { icon: <BellIcon />, label: '呼出時間', value: `${data.ringTime}秒` },
    { icon: <CalendarIcon />, label: '日付', value: data.date },
    { icon: <ArrowUpDown />, label: '通話方向', value: data.direction },
    { icon: <UserIcon />, label: '担当者', value: data.agent },
    { icon: <PhoneIcon />, label: '電話番号', value: data.agentPhone },
  ];

  // Initialize Whisper
  useEffect(() => {
    isMountedRef.current = true;
    // Reset transcription state on mount
    setConversation([]);
    setIsInitialOnly(true);
    checkAndLoadModel();
    return () => {
      isMountedRef.current = false;
      // Release whisper context
      if (whisperContextRef.current) {
        try {
          whisperContextRef.current.release();
        } catch (e) {
          console.log('[Whisper] release error (ignored):', e);
        }
      }
    };
  }, []);

  // Auto-transcribe first 15 seconds when model is ready
  useEffect(() => {
    if (modelReady && conversation.length === 0 && !isTranscribing) {
      transcribeInitial();
    }
  }, [modelReady]);

  const getModelPath = () => `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;

  const checkAndLoadModel = async () => {
    const modelPath = getModelPath();
    const exists = await RNFS.exists(modelPath);
    if (exists) {
      // Check file size to detect corrupted/partial downloads
      try {
        const stat = await RNFS.stat(modelPath);
        const fileSize = parseInt(stat.size, 10);
        // Allow 5% tolerance for size check
        if (fileSize < MODEL_EXPECTED_SIZE * 0.95) {
          console.log(`[Whisper] Model file corrupted: ${fileSize} < ${MODEL_EXPECTED_SIZE}`);
          await RNFS.unlink(modelPath);
          console.log('[Whisper] Deleted corrupted model file');
          return; // Don't initialize, let user download again
        }
      } catch (e) {
        console.log('[Whisper] Could not check file size:', e);
      }
      await initializeWhisper(modelPath);
    }
  };

  const downloadModel = async () => {
    const modelPath = getModelPath();
    const exists = await RNFS.exists(modelPath);

    if (exists) {
      await initializeWhisper(modelPath);
      return;
    }

    setIsModelLoading(true);
    setModelProgress(0);

    try {
      const downloadResult = RNFS.downloadFile({
        fromUrl: MODEL_URL,
        toFile: modelPath,
        progress: (res) => {
          // Only update state if still mounted
          if (isMountedRef.current) {
            const prog = (res.bytesWritten / res.contentLength) * 100;
            setModelProgress(Math.round(prog));
          }
        },
        progressDivider: 1,
      });

      const result = await downloadResult.promise;

      // Check if component unmounted during download
      if (!isMountedRef.current) {
        // Clean up partial/complete download since user left
        try { await RNFS.unlink(modelPath); } catch (e) {}
        return;
      }

      if (result.statusCode === 200) {
        await initializeWhisper(modelPath);
      } else {
        // Clean up partial download
        try { await RNFS.unlink(modelPath); } catch (e) {}
        Alert.alert('エラー', 'モデルのダウンロードに失敗しました');
      }
    } catch (error) {
      // Clean up partial download on error
      try { await RNFS.unlink(modelPath); } catch (e) {}
      if (isMountedRef.current) {
        Alert.alert('エラー', `ダウンロード失敗: ${error.message}`);
      }
    } finally {
      if (isMountedRef.current) {
        setIsModelLoading(false);
      }
    }
  };

  const initializeWhisper = async (modelPath) => {
    try {
      if (!isMountedRef.current) return;
      setIsModelLoading(true);
      console.log('[Whisper] Initializing with path:', modelPath);
      const context = await initWhisper({ filePath: modelPath });

      if (!isMountedRef.current) return;

      // Validate context
      if (!context) {
        throw new Error('Context is null');
      }

      console.log('[Whisper] Context created successfully');
      whisperContextRef.current = context;
      setModelReady(true);
    } catch (error) {
      console.error('[Whisper] Init failed:', error);
      // Delete corrupted model file
      try {
        await RNFS.unlink(modelPath);
        console.log('[Whisper] Deleted corrupted model');
      } catch (e) {}
      // Ask user to re-download (only if still mounted)
      if (isMountedRef.current) {
        Alert.alert(
          'エラー',
          'モデルファイルが破損しています。再ダウンロードしますか？',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '再ダウンロード', onPress: () => downloadModel() },
          ]
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsModelLoading(false);
      }
    }
  };

  // Get audio file path from assets
  const getAudioFilePath = async (trackKey) => {
    const audioSource = AUDIO_FILES[trackKey].source;
    // Use timestamp to force fresh copy
    const destPath = `${RNFS.DocumentDirectoryPath}/${trackKey}_v2.wav`;

    // Always delete cached file to ensure fresh copy from assets
    const exists = await RNFS.exists(destPath);
    if (exists) {
      await RNFS.unlink(destPath);
      console.log(`[Audio] Deleted cached: ${destPath}`);
    }

    try {
      const resolved = Image.resolveAssetSource(audioSource);
      console.log(`[Audio] ${trackKey} resolved:`, JSON.stringify(resolved));

      if (!resolved || !resolved.uri) {
        console.error(`[Audio] Failed to resolve: ${trackKey}`);
        return null;
      }

      const uri = resolved.uri;

      if (uri.startsWith('http')) {
        console.log(`[Audio] Downloading from: ${uri}`);
        const downloadResult = await RNFS.downloadFile({
          fromUrl: uri,
          toFile: destPath,
        }).promise;

        if (downloadResult.statusCode === 200) {
          const stat = await RNFS.stat(destPath);
          console.log(`[Audio] Downloaded ${trackKey}: ${stat.size} bytes`);
          return destPath;
        }
      } else if (uri.startsWith('file://')) {
        const sourcePath = uri.replace('file://', '');
        await RNFS.copyFile(sourcePath, destPath);
        const stat = await RNFS.stat(destPath);
        console.log(`[Audio] Copied ${trackKey}: ${stat.size} bytes`);
        return destPath;
      } else if (Platform.OS === 'android') {
        // Android: copy from assets using copyFileAssets
        const assetMap = {
          personA: 'person_a_final',
          personB: 'person_b_final',
          personBTrimmed: 'person_b_trimmed',
          merged: 'merged_conversation',
          stereo: 'stereo_conversation',
        };
        const assetPath = `audio/${assetMap[trackKey] || trackKey}.wav`;
        console.log(`[Audio] Android asset path: ${assetPath}`);
        await RNFS.copyFileAssets(assetPath, destPath);
        const stat = await RNFS.stat(destPath);
        console.log(`[Audio] Copied from assets ${trackKey}: ${stat.size} bytes`);
        return destPath;
      }

      return null;
    } catch (error) {
      console.error(`[Audio] Error for ${trackKey}:`, error);
      return null;
    }
  };

  // Helper: decode base64 to Uint8Array
  const base64ToUint8Array = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  // Helper: encode Uint8Array to base64
  const uint8ArrayToBase64 = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Helper: find data chunk in WAV
  const findDataChunk = (wavBytes) => {
    for (let i = 12; i < Math.min(wavBytes.length - 8, 200); i++) {
      if (wavBytes[i] === 0x64 && wavBytes[i+1] === 0x61 && wavBytes[i+2] === 0x74 && wavBytes[i+3] === 0x61) {
        const dataSize = wavBytes[i+4] | (wavBytes[i+5] << 8) | (wavBytes[i+6] << 16) | (wavBytes[i+7] << 24);
        return { dataSize, dataStart: i + 8 };
      }
    }
    return { dataSize: wavBytes.length - 44, dataStart: 44 };
  };

  // Cut WAV file to extract time range
  const cutWavChunk = async (inputPath, startTime, endTime) => {
    try {
      const wavBase64 = await RNFS.readFile(inputPath, 'base64');
      const wavBytes = base64ToUint8Array(wavBase64);
      const { dataSize, dataStart } = findDataChunk(wavBytes);
      const bytesPerSecond = SAMPLE_RATE * BYTES_PER_SAMPLE * NUM_CHANNELS;

      const startOffset = Math.floor(startTime * bytesPerSecond);
      const endOffset = Math.floor(endTime * bytesPerSecond);
      const actualStart = dataStart + Math.min(startOffset, dataSize);
      const actualEnd = dataStart + Math.min(endOffset, dataSize);
      const dataLength = actualEnd - actualStart;

      if (dataLength <= 0) return null;

      // Build new WAV with 44-byte header
      const newWav = new Uint8Array(44 + dataLength);
      // RIFF header
      [0x52,0x49,0x46,0x46].forEach((v,i) => newWav[i] = v);
      const fileSize = 36 + dataLength;
      newWav[4] = fileSize & 0xFF; newWav[5] = (fileSize >> 8) & 0xFF;
      newWav[6] = (fileSize >> 16) & 0xFF; newWav[7] = (fileSize >> 24) & 0xFF;
      [0x57,0x41,0x56,0x45,0x66,0x6D,0x74,0x20].forEach((v,i) => newWav[8+i] = v);
      [16,0,0,0,1,0,1,0].forEach((v,i) => newWav[16+i] = v);
      newWav[24] = SAMPLE_RATE & 0xFF; newWav[25] = (SAMPLE_RATE >> 8) & 0xFF;
      newWav[26] = (SAMPLE_RATE >> 16) & 0xFF; newWav[27] = (SAMPLE_RATE >> 24) & 0xFF;
      newWav[28] = bytesPerSecond & 0xFF; newWav[29] = (bytesPerSecond >> 8) & 0xFF;
      newWav[30] = (bytesPerSecond >> 16) & 0xFF; newWav[31] = (bytesPerSecond >> 24) & 0xFF;
      newWav[32] = 2; newWav[33] = 0; newWav[34] = 16; newWav[35] = 0;
      [0x64,0x61,0x74,0x61].forEach((v,i) => newWav[36+i] = v);
      newWav[40] = dataLength & 0xFF; newWav[41] = (dataLength >> 8) & 0xFF;
      newWav[42] = (dataLength >> 16) & 0xFF; newWav[43] = (dataLength >> 24) & 0xFF;
      for (let i = 0; i < dataLength; i++) newWav[44 + i] = wavBytes[actualStart + i];

      const outPath = `${RNFS.DocumentDirectoryPath}/chunk_${startTime}_${endTime}.wav`;
      await RNFS.writeFile(outPath, uint8ArrayToBase64(newWav), 'base64');
      return outPath;
    } catch (e) {
      console.error('[WAV] Cut error:', e);
      return null;
    }
  };

  // Transcribe first 15 seconds only (fast initial load)
  const transcribeInitial = async () => {
    if (!whisperContextRef.current) return;

    setIsTranscribing(true);
    setTranscribeStatus('文字起こし中...');

    try {
      const personAPath = await getAudioFilePath('personA');
      const personBPath = await getAudioFilePath('personBTrimmed');
      if (!personAPath || !personBPath) throw new Error('音声ファイルの読み込みに失敗しました');

      let segsA = [], segsB = [];

      // Cut and transcribe first 15s of Operator
      const chunkA = await cutWavChunk(personAPath, 0, INITIAL_SECONDS);
      if (chunkA) {
        const { promise } = whisperContextRef.current.transcribe(chunkA, {
          language: 'ja', maxLen: 0, tokenTimestamps: true,
          temperature: 0, temperatureInc: 0.2, noSpeechThold: 0.6,
        });
        const result = await promise;
        segsA = (result?.segments || []).map(s => ({
          text: s.text?.trim() || '', startTime: (s.t0 || 0) / 100, endTime: (s.t1 || 0) / 100, speaker: 'A',
        }));
        await RNFS.unlink(chunkA).catch(() => {});
      }

      // Cut and transcribe first 8s of Customer (15s - 7s offset) - only for 2-speaker mode
      if (!singleSpeaker) {
        const customerEndTime = INITIAL_SECONDS - PERSON_B_OFFSET;
        if (customerEndTime > 0) {
          const chunkB = await cutWavChunk(personBPath, 0, customerEndTime);
          if (chunkB) {
            const { promise } = whisperContextRef.current.transcribe(chunkB, {
              language: 'ja', maxLen: 0, tokenTimestamps: true,
              temperature: 0, temperatureInc: 0.2, noSpeechThold: 0.6,
            });
            const result = await promise;
            segsB = (result?.segments || []).map(s => ({
              text: s.text?.trim() || '',
              startTime: PERSON_B_OFFSET + (s.t0 || 0) / 100,
              endTime: PERSON_B_OFFSET + (s.t1 || 0) / 100,
              speaker: 'B',
            }));
            await RNFS.unlink(chunkB).catch(() => {});
          }
        }
      }

      const noise = ['(音楽)', '[音楽]', '♪', '🎵'];
      const allSegs = [...segsA, ...segsB]
        .filter(s => s.text.length > 0 && !noise.some(n => s.text.includes(n)))
        .sort((a, b) => a.startTime - b.startTime);

      console.log('[Initial] Segments:', allSegs.length);
      setConversation(allSegs);
      setIsInitialOnly(true);
      setTranscribeStatus('');
    } catch (error) {
      console.error('[Initial] Error:', error);
      Alert.alert('エラー', `文字起こし失敗: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Transcribe FULL audio (when user wants all - better accuracy)
  const transcribeFull = async () => {
    if (!whisperContextRef.current || isTranscribing) return;

    setIsLoadingMore(true);
    setIsTranscribing(true);
    setTranscribeStatus('文字起こし中...');

    try {
      const personAPath = await getAudioFilePath('personA');
      if (!personAPath) throw new Error('音声ファイルの読み込みに失敗しました');

      // Transcribe FULL Operator audio
      const { promise: promiseA } = whisperContextRef.current.transcribe(personAPath, {
        language: 'ja', maxLen: 0, tokenTimestamps: true,
        temperature: 0, temperatureInc: 0.2, noSpeechThold: 0.6,
      });
      const resultA = await promiseA;
      const segsA = (resultA?.segments || []).map(s => ({
        text: s.text?.trim() || '', startTime: (s.t0 || 0) / 100, endTime: (s.t1 || 0) / 100, speaker: 'A',
      }));

      let segsB = [];
      // Transcribe FULL Customer audio - only for 2-speaker mode
      if (!singleSpeaker) {
        const personBPath = await getAudioFilePath('personBTrimmed');
        if (personBPath) {
          const { promise: promiseB } = whisperContextRef.current.transcribe(personBPath, {
            language: 'ja', maxLen: 0, tokenTimestamps: true,
            temperature: 0, temperatureInc: 0.2, noSpeechThold: 0.6,
          });
          const resultB = await promiseB;
          segsB = (resultB?.segments || []).map(s => ({
            text: s.text?.trim() || '',
            startTime: PERSON_B_OFFSET + (s.t0 || 0) / 100,
            endTime: PERSON_B_OFFSET + (s.t1 || 0) / 100,
            speaker: 'B',
          }));
        }
      }

      const noise = ['(音楽)', '[音楽]', '♪', '🎵'];
      const allSegs = [...segsA, ...segsB]
        .filter(s => s.text.length > 0 && !noise.some(n => s.text.includes(n)))
        .sort((a, b) => a.startTime - b.startTime);

      console.log('[Full] Total segments:', allSegs.length);
      setConversation(allSegs);
      setIsInitialOnly(false);
      setTranscribeStatus('');
    } catch (error) {
      console.error('[Full] Error:', error);
      Alert.alert('エラー', `文字起こし失敗: ${error.message}`);
    } finally {
      setIsTranscribing(false);
      setIsLoadingMore(false);
    }
  };

  // Audio player handlers
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const onLoad = (data) => {
    setDuration(data.duration);
  };
  const onProgress = (data) => {
    setCurrentTime(data.currentTime);
    setProgress(duration > 0 ? (data.currentTime / duration) * 100 : 0);
  };
  const onEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const skip = (seconds) => {
    if (playerRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      playerRef.current.seek(newTime);
    }
  };

  return (
    <View style={styles.container}>
      {/* Hidden audio player */}
      {activeTrack && AUDIO_FILES[activeTrack] && (
        <Video
          ref={playerRef}
          source={AUDIO_FILES[activeTrack].source}
          paused={!isPlaying}
          volume={1.0}
          onLoad={onLoad}
          onProgress={onProgress}
          onEnd={onEnd}
          onError={(error) => {
            console.error('Audio error:', error);
            Alert.alert('音声エラー', JSON.stringify(error));
          }}
          audioOnly={true}
          playInBackground={true}
          playWhenInactive={true}
          progressUpdateInterval={250}
          style={{ width: 0, height: 0 }}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通話履歴詳細</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Section */}
        <Text style={styles.sectionLabel}>通話先</Text>
        <View style={styles.contactCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>不</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{data.contactName}</Text>
            <Text style={styles.contactNumber}>{data.phoneNumber}</Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <PhoneCall />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Call Info Section */}
        <Text style={styles.sectionLabel}>通話情報</Text>
        <View style={styles.infoGrid}>
          {callInfo.map((item, index) => (
            <View key={index} style={styles.infoItem}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Audio Player */}
        <View style={styles.audioPlayer}>
          <View style={styles.audioHeader}>
            <View style={styles.audioTitleRow}>
              <WaveformIcon />
              <Text style={styles.audioTitle}>通話録音</Text>
            </View>
            <TouchableOpacity style={styles.volumeButton}>
              <VolumeIcon />
            </TouchableOpacity>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFilled, { width: `${progress}%` }]} />
            </View>
            <View style={[styles.sliderThumb, { left: `${progress}%` }]} />
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(duration || data.duration)}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => skip(-10)}>
              <Replay10 />
              <Text style={styles.skipText}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => skip(10)}>
              <Forward10 />
              <Text style={styles.skipText}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Transcribe Status - inside player (hide when loading more, shown at bottom instead) */}
          {modelReady && isTranscribing && !isLoadingMore && (
            <View style={styles.transcribeStatusBar}>
              <ActivityIndicator color="#1a7a6d" size="small" />
              <Text style={styles.transcribeStatusText}>{transcribeStatus || '処理中...'}</Text>
            </View>
          )}

          {/* Download Model Button if not ready */}
          {!modelReady && (
            <TouchableOpacity
              style={[styles.downloadModelBtn, isModelLoading && styles.btnDisabled]}
              onPress={downloadModel}
              disabled={isModelLoading}
            >
              {isModelLoading ? (
                <View style={styles.transcribeLoading}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.transcribeBtnText}> ダウンロード中 {modelProgress}%</Text>
                </View>
              ) : (
                <Text style={styles.transcribeBtnText}>Whisperモデルをダウンロード</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Conversation Content */}
        {conversation.length > 0 && (
          <View style={styles.chatSection}>
            <Text style={styles.chatTitle}>通話内容</Text>

            {singleSpeaker ? (
              /* Single Speaker Mode - Paragraph Style */
              <View style={styles.paragraphContainer}>
                {conversation.map((item, index) => (
                  <Text key={index} style={styles.paragraphText}>
                    {item.text}
                  </Text>
                ))}
              </View>
            ) : (
              /* Two Speakers Mode - Chat Style */
              conversation.map((item, index) => (
                <View
                  key={index}
                  style={item.speaker === 'A' ? styles.chatBubbleA : styles.chatBubbleB}
                >
                  <View style={styles.chatHeader}>
                    <Text style={[styles.chatSpeaker, { color: item.speaker === 'A' ? '#1976D2' : '#C2185B' }]}>
                      {item.speaker === 'A' ? 'オペレーター' : 'お客様'}
                    </Text>
                    <Text style={styles.chatTime}>
                      {item.startTime.toFixed(1)}s
                    </Text>
                  </View>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              ))
            )}

            {/* Show more button - only when initial transcription */}
            {isInitialOnly && !isTranscribing && (
              <View style={styles.showMoreContainer}>
                <TouchableOpacity style={styles.showMoreBtn} onPress={transcribeFull}>
                  <Text style={styles.showMoreText}>すべて表示</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading indicator */}
            {isLoadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator color="#1a7a6d" size="small" />
                <Text style={styles.loadingMoreText}>文字起こし中...</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
  },
  contactNumber: {
    fontSize: 14,
    color: '#888',
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  infoItem: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextGroup: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 12.5,
    color: '#888',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14.5,
    color: '#222',
    fontWeight: '600',
  },
  audioPlayer: {
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  audioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  volumeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderContainer: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  sliderFilled: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#333',
    marginLeft: -10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    marginTop: 10,
  },
  controlButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 9,
    color: '#555',
    fontWeight: '700',
    marginTop: -6,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5D94E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Transcribe button
  transcribeMainBtn: {
    backgroundColor: '#1a7a6d',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  transcribeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  transcribeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadModelBtn: {
    backgroundColor: '#6200EE',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: {
    backgroundColor: '#9E9E9E',
  },
  // Chat section
  chatSection: {
    marginTop: 20,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  chatBubbleA: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    marginBottom: 8,
    marginRight: 50,
  },
  chatBubbleB: {
    backgroundColor: '#FCE4EC',
    padding: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
    marginBottom: 8,
    marginLeft: 50,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatSpeaker: {
    fontSize: 12,
    fontWeight: '600',
  },
  chatTime: {
    fontSize: 11,
    color: '#888',
  },
  chatText: {
    fontSize: 15,
    color: '#222',
    lineHeight: 22,
  },
  // Paragraph style for single speaker
  paragraphContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
  },
  paragraphText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 26,
    marginBottom: 12,
    textAlign: 'justify',
  },
  // Show More buttons
  showMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  showMoreBtn: {
    backgroundColor: '#1a7a6d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  showMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    marginTop: 8,
  },
  loadingMoreText: {
    color: '#1a7a6d',
    fontSize: 14,
    fontWeight: '500',
  },
  allLoadedText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
    marginTop: 12,
    fontStyle: 'italic',
  },
  // Transcribe status bar (auto-transcribing)
  transcribeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    marginTop: 16,
    backgroundColor: '#E8F5F2',
    borderRadius: 12,
  },
  transcribeStatusText: {
    color: '#1a7a6d',
    fontSize: 14,
    fontWeight: '600',
  },
  retranscribeBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  retranscribeText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default CallDetailScreen;
