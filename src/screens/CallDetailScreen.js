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

// Progressive display settings
const DISPLAY_CHUNK_SECONDS = 15; // Show first 15 seconds initially


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

const CallDetailScreen = ({ callData = {}, onBack }) => {
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

  // Transcription states (eager load with progressive display)
  const [conversation, setConversation] = useState([]);
  const [showUpTo, setShowUpTo] = useState(DISPLAY_CHUNK_SECONDS); // Display up to this many seconds
  const [hasTranscribed, setHasTranscribed] = useState(false);

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
    setShowUpTo(DISPLAY_CHUNK_SECONDS);
    setHasTranscribed(false);
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

  // Auto-transcribe full audio when model is ready
  useEffect(() => {
    if (modelReady && !hasTranscribed && !isTranscribing) {
      transcribeFullAudio();
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

  // Transcribe full audio (eager load) - better quality than chunked approach
  const transcribeFullAudio = async () => {
    if (!whisperContextRef.current) {
      Alert.alert('エラー', 'Whisperモデルをダウンロードしてください');
      return;
    }

    setIsTranscribing(true);
    setTranscribeStatus('文字起こし中...');

    try {
      // Get audio file paths
      const personAPath = await getAudioFilePath('personA');
      const personBPath = await getAudioFilePath('personBTrimmed');

      if (!personAPath || !personBPath) {
        throw new Error('音声ファイルの読み込みに失敗しました');
      }

      // Transcribe full Operator audio
      const { promise: promiseA } = whisperContextRef.current.transcribe(personAPath, {
        language: 'ja',
        maxLen: 0,
        tokenTimestamps: true,
        temperature: 0,
        temperatureInc: 0.2,
        noSpeechThold: 0.6,
      });
      const resultA = await promiseA;
      const segsA = (resultA?.segments || []).map(s => ({
        text: s.text?.trim() || '',
        startTime: (s.t0 || 0) / 100,
        endTime: (s.t1 || 0) / 100,
        speaker: 'A',
      }));
      console.log('[Transcribe] Operator segments:', segsA.length);

      // Transcribe full Customer audio (trimmed version)
      const { promise: promiseB } = whisperContextRef.current.transcribe(personBPath, {
        language: 'ja',
        maxLen: 0,
        tokenTimestamps: true,
        temperature: 0,
        temperatureInc: 0.2,
        noSpeechThold: 0.6,
      });
      const resultB = await promiseB;
      // Add PERSON_B_OFFSET to customer timestamps (audio was trimmed)
      const segsB = (resultB?.segments || []).map(s => ({
        text: s.text?.trim() || '',
        startTime: PERSON_B_OFFSET + (s.t0 || 0) / 100,
        endTime: PERSON_B_OFFSET + (s.t1 || 0) / 100,
        speaker: 'B',
      }));
      console.log('[Transcribe] Customer segments:', segsB.length);

      // Filter out noise markers
      const noise = ['(音楽)', '[音楽]', '♪', '🎵'];
      const filterNoise = (seg) => seg.text.length > 0 && !noise.some(n => seg.text.includes(n));

      // Merge and sort by time
      const allSegments = [...segsA, ...segsB]
        .filter(filterNoise)
        .sort((a, b) => a.startTime - b.startTime);

      console.log('[Transcribe] Total segments:', allSegments.length);

      setConversation(allSegments);
      setHasTranscribed(true);
      setTranscribeStatus('');
    } catch (error) {
      console.error('[Transcribe] Error:', error);
      Alert.alert('エラー', `文字起こし失敗: ${error.message}`);
      setTranscribeStatus('');
    } finally {
      setIsTranscribing(false);
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

          {/* Transcribe Status - inside player */}
          {modelReady && isTranscribing && (
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

        {/* Conversation Chat - progressive display */}
        {hasTranscribed && conversation.length > 0 && (() => {
          // Filter to show only up to showUpTo seconds
          const visibleConversation = conversation.filter(item => item.startTime <= showUpTo);
          const maxTime = Math.max(...conversation.map(item => item.endTime || item.startTime));
          const hasMore = showUpTo < maxTime;

          return (
            <View style={styles.chatSection}>
              <Text style={styles.chatTitle}>
                会話内容 ({visibleConversation.length}/{conversation.length}件)
              </Text>

              {visibleConversation.map((item, index) => (
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
              ))}

              {/* Show All button */}
              {hasMore && (
                <View style={styles.showMoreContainer}>
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() => setShowUpTo(9999)}
                  >
                    <Text style={styles.showMoreText}>すべて表示</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

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
