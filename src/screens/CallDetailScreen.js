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
import { initializeSTT, transcribeFile, unloadSTT } from 'react-native-sherpa-onnx/stt';

// Sherpa-ONNX Model Settings - ReazonSpeech Japanese model (148MB, high accuracy)
const MODEL_DIR = `${RNFS.DocumentDirectoryPath}/model`;
const MODEL_FILES = [
  { src: 'tokens.txt', dest: 'tokens.txt' },
  { src: 'encoder.onnx', dest: 'encoder.onnx' },
  { src: 'decoder.onnx', dest: 'decoder.onnx' },
  { src: 'joiner.onnx', dest: 'joiner.onnx' }
];

// Audio chunking settings - balance accuracy vs completeness
const CHUNK_DURATION = 12; // 12 second chunks
const CHUNK_OVERLAP = 4; // 4 second overlap to avoid cutting words
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const NUM_CHANNELS = 1;

// Audio URLs (WAV files - works with any storage: GCS, S3, Cloudinary, etc.)
// Will only process first AUDIO_DURATION_LIMIT seconds on device
const AUDIO_DURATION_LIMIT = 15; // seconds - chỉ xử lý 15s đầu
const AUDIO_URLS = {
  personA: 'https://res.cloudinary.com/ditcozn90/video/upload/v1770966537/15_07_50-in_n9li47.wav',  // Operator (オペレーター)
  personB: 'https://res.cloudinary.com/ditcozn90/video/upload/v1770966613/15_07_50-out_zwe4yj.wav', // Customer (お客様)
};

// Audio files (fallback for bundled assets)
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

const PERSON_B_OFFSET = 0; // Audio files from URL are separate recordings, no offset needed

// Icons (unchanged)
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTrack, setActiveTrack] = useState('merged');
  const playerRef = useRef(null);

  const isMountedRef = useRef(true);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState('');

  const [conversation, setConversation] = useState([]);
  const [urlAudioPath, setUrlAudioPath] = useState(null); // Path to downloaded URL audio

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

  const displayDuration = duration > 0 ? Math.round(duration) : data.duration;

  const callInfo = [
    { icon: <HourglassIcon />, label: '通話時間', value: `${displayDuration}秒` },
    { icon: <BellIcon />, label: '呼出時間', value: `${data.ringTime}秒` },
    { icon: <CalendarIcon />, label: '日付', value: data.date },
    { icon: <ArrowUpDown />, label: '通話方向', value: data.direction },
    { icon: <UserIcon />, label: '担当者', value: data.agent },
    { icon: <PhoneIcon />, label: '電話番号', value: data.agentPhone },
  ];

  useEffect(() => {
    isMountedRef.current = true;
    setConversation([]);
    prepareAndInitSherpa();

    return () => {
      isMountedRef.current = false;
      unloadSTT().catch(e => console.log('Unload error:', e));
    };
  }, []);

  useEffect(() => {
    if (modelReady && conversation.length === 0 && !isTranscribing) {
      transcribeAudio();
    }
  }, [modelReady]);

  const prepareAndInitSherpa = async () => {
    try {
      setIsModelLoading(true);

      console.log('[Sherpa] Checking model directory:', MODEL_DIR);
      await RNFS.mkdir(MODEL_DIR);

      let missingFiles = false;
      for (const file of MODEL_FILES) {
        const destPath = `${MODEL_DIR}/${file.dest}`;
        const exists = await RNFS.exists(destPath);
        if (!exists) {
          missingFiles = true;
          console.log(`[Sherpa] Missing: ${file.dest}`);
          break;
        }
      }

      if (missingFiles) {
        console.log('[Sherpa] Copying model files from assets...');
        if (Platform.OS === 'android') {
          for (const file of MODEL_FILES) {
            const destPath = `${MODEL_DIR}/${file.dest}`;
            const exists = await RNFS.exists(destPath);
            if (!exists) {
              console.log(`[Sherpa] Copying ${file.src} to ${file.dest}`);
              await RNFS.copyFileAssets(`model/${file.src}`, destPath);
            }
          }
        } else {
          console.warn('[Sherpa] iOS asset copy not implemented yet');
        }
      }

      console.log('[Sherpa] Initializing with:', MODEL_DIR);
      const result = await initializeSTT({
        modelPath: { type: 'file', path: MODEL_DIR },
        preferInt8: true,
        modelType: 'transducer',
      });

      if (result.success) {
        console.log('[Sherpa] Initialized:', result.detectedModels);
        if (isMountedRef.current) setModelReady(true);
      } else {
        console.error('[Sherpa] Init failed');
        Alert.alert('エラー', 'モデルの初期化に失敗しました');
      }

    } catch (error) {
      console.error('[Sherpa] Setup error:', error);
      if (isMountedRef.current) {
        Alert.alert('エラー', `モデル設定エラー: ${error.message}`);
      }
    } finally {
      if (isMountedRef.current) setIsModelLoading(false);
    }
  };

  // Download audio from URL and resample 8kHz → 16kHz (chunked to avoid OOM)
  const downloadAndResampleAudio = async (url, destPath) => {
    console.log(`[Audio] Downloading from URL: ${url}`);

    const tempPath = destPath + '.8k.wav';

    // Calculate bytes needed for AUDIO_DURATION_LIMIT seconds
    // Assuming 8kHz, 16-bit mono: 8000 * 2 = 16000 bytes per second
    const estimatedBytesPerSec = 8000 * 2; // 8kHz, 16-bit
    const bytesNeeded = 44 + (AUDIO_DURATION_LIMIT * estimatedBytesPerSec); // header + data

    // Download with Range header to get only first N bytes
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tempPath,
      headers: {
        'Range': `bytes=0-${bytesNeeded}`,
      },
    }).promise;

    // 200 = full file, 206 = partial content (Range worked)
    if (downloadResult.statusCode !== 200 && downloadResult.statusCode !== 206) {
      throw new Error(`Download failed: ${downloadResult.statusCode}`);
    }

    const rangeWorked = downloadResult.statusCode === 206;
    console.log(`[Audio] Downloaded ${downloadResult.bytesWritten} bytes ${rangeWorked ? '(Range OK)' : '(full file)'}`);

    // Read just the header to get sample rate and data size
    const headerBase64 = await RNFS.read(tempPath, 44, 0, 'base64');
    const headerBytes = base64ToUint8Array(headerBase64);

    const sampleRate = headerBytes[24] | (headerBytes[25] << 8) | (headerBytes[26] << 16) | (headerBytes[27] << 24);
    console.log(`[Audio] Source sample rate: ${sampleRate}Hz`);

    if (sampleRate === SAMPLE_RATE) {
      await RNFS.moveFile(tempPath, destPath);
      return destPath;
    }

    // Get file size and calculate data length
    const fileInfo = await RNFS.stat(tempPath);
    const fileSize = fileInfo.size;
    const dataLen = fileSize - 44;
    const totalSamples = Math.floor(dataLen / 2);

    // Limit to first AUDIO_DURATION_LIMIT seconds only
    const maxSamples = AUDIO_DURATION_LIMIT * sampleRate;
    const numSamples = Math.min(totalSamples, maxSamples);

    const ratio = SAMPLE_RATE / sampleRate;
    const newNumSamples = Math.floor(numSamples * ratio);
    const newDataLen = newNumSamples * 2;

    const totalDuration = (totalSamples / sampleRate).toFixed(1);
    const limitedDuration = (numSamples / sampleRate).toFixed(1);
    console.log(`[Audio] File: ${totalDuration}s, using first ${limitedDuration}s only`);
    console.log(`[Audio] Resampling ${numSamples} samples → ${newNumSamples} samples`);

    // Create WAV header for 16kHz
    const bytesPerSecond = SAMPLE_RATE * BYTES_PER_SAMPLE * NUM_CHANNELS;
    const header = new Uint8Array(44);
    [0x52,0x49,0x46,0x46].forEach((v,i) => header[i] = v);
    const newFileSize = 36 + newDataLen;
    header[4] = newFileSize & 0xFF; header[5] = (newFileSize >> 8) & 0xFF;
    header[6] = (newFileSize >> 16) & 0xFF; header[7] = (newFileSize >> 24) & 0xFF;
    [0x57,0x41,0x56,0x45,0x66,0x6D,0x74,0x20].forEach((v,i) => header[8+i] = v);
    [16,0,0,0,1,0,1,0].forEach((v,i) => header[16+i] = v);
    header[24] = SAMPLE_RATE & 0xFF; header[25] = (SAMPLE_RATE >> 8) & 0xFF;
    header[26] = (SAMPLE_RATE >> 16) & 0xFF; header[27] = (SAMPLE_RATE >> 24) & 0xFF;
    header[28] = bytesPerSecond & 0xFF; header[29] = (bytesPerSecond >> 8) & 0xFF;
    header[30] = (bytesPerSecond >> 16) & 0xFF; header[31] = (bytesPerSecond >> 24) & 0xFF;
    header[32] = 2; header[33] = 0; header[34] = 16; header[35] = 0;
    [0x64,0x61,0x74,0x61].forEach((v,i) => header[36+i] = v);
    header[40] = newDataLen & 0xFF; header[41] = (newDataLen >> 8) & 0xFF;
    header[42] = (newDataLen >> 16) & 0xFF; header[43] = (newDataLen >> 24) & 0xFF;

    // Write header first
    await RNFS.writeFile(destPath, uint8ArrayToBase64(header), 'base64');

    // Process in chunks to avoid OOM (1MB chunks = 500K samples at 16-bit)
    const CHUNK_SAMPLES = 500000; // Process 500K samples at a time
    const CHUNK_BYTES = CHUNK_SAMPLES * 2;
    let processedSamples = 0;
    let prevSample = 0;

    while (processedSamples < numSamples) {
      const samplesToRead = Math.min(CHUNK_SAMPLES, numSamples - processedSamples);
      const bytesToRead = samplesToRead * 2;
      const offset = 44 + processedSamples * 2;

      // Read chunk
      const chunkBase64 = await RNFS.read(tempPath, bytesToRead, offset, 'base64');
      const chunkBytes = base64ToUint8Array(chunkBase64);

      // Parse samples
      const samples = new Int16Array(samplesToRead);
      for (let i = 0; i < samplesToRead; i++) {
        samples[i] = chunkBytes[i * 2] | (chunkBytes[i * 2 + 1] << 8);
      }

      // Resample this chunk
      const outputStart = Math.floor(processedSamples * ratio);
      const outputEnd = Math.floor((processedSamples + samplesToRead) * ratio);
      const outputSamples = outputEnd - outputStart;

      const resampled = new Uint8Array(outputSamples * 2);
      for (let i = 0; i < outputSamples; i++) {
        const srcPos = (outputStart + i) / ratio - processedSamples;
        const srcIndex = Math.floor(srcPos);
        const frac = srcPos - srcIndex;

        let sample;
        if (srcIndex < 0) {
          sample = prevSample;
        } else if (srcIndex + 1 < samplesToRead) {
          sample = Math.round(samples[srcIndex] * (1 - frac) + samples[srcIndex + 1] * frac);
        } else {
          sample = samples[Math.min(srcIndex, samplesToRead - 1)];
        }

        resampled[i * 2] = sample & 0xFF;
        resampled[i * 2 + 1] = (sample >> 8) & 0xFF;
      }

      // Append to output file
      await RNFS.appendFile(destPath, uint8ArrayToBase64(resampled), 'base64');

      prevSample = samples[samplesToRead - 1];
      processedSamples += samplesToRead;

      // Log progress every 10%
      const progress = Math.floor((processedSamples / numSamples) * 100);
      if (progress % 10 === 0) {
        console.log(`[Audio] Resampling progress: ${progress}%`);
      }
    }

    // Clean up temp file
    await RNFS.unlink(tempPath).catch(() => {});

    console.log(`[Audio] Resampled to 16kHz: ${destPath}`);
    return destPath;
  };

  const getAudioFilePath = async (trackKey) => {
    const destPath = `${RNFS.DocumentDirectoryPath}/${trackKey}_url_v5_range15s.wav`;

    // Check if already downloaded and resampled
    const exists = await RNFS.exists(destPath);
    if (exists) {
      console.log(`[Audio] Using cached: ${destPath}`);
      return destPath;
    }

    // Try to download from URL first
    if (AUDIO_URLS[trackKey]) {
      try {
        return await downloadAndResampleAudio(AUDIO_URLS[trackKey], destPath);
      } catch (error) {
        console.error(`[Audio] URL download failed for ${trackKey}:`, error);
        // Fall through to bundled assets
      }
    }

    // Fallback to bundled assets
    const bundledPath = `${RNFS.DocumentDirectoryPath}/${trackKey}_bundled.wav`;
    const bundledExists = await RNFS.exists(bundledPath);
    if (bundledExists) return bundledPath;

    try {
      if (Platform.OS === 'android') {
        const assetMap = {
          personA: 'person_a_final',
          personB: 'person_b_final',
          personBTrimmed: 'person_b_trimmed',
          merged: 'merged_conversation',
          stereo: 'stereo_conversation',
        };
        const assetPath = `audio/${assetMap[trackKey] || trackKey}.wav`;
        await RNFS.copyFileAssets(assetPath, bundledPath);
        return bundledPath;
      } else {
        const audioSource = AUDIO_FILES[trackKey].source;
        const resolved = Image.resolveAssetSource(audioSource);
        if (resolved && resolved.uri) return resolved.uri;
      }
      return null;
    } catch (error) {
      console.error(`[Audio] Error for ${trackKey}:`, error);
      return null;
    }
  };


  // WAV chunking helpers - needed because model has input length limitation
  const base64ToUint8Array = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const uint8ArrayToBase64 = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Merge two WAV files into one (mix audio from both channels)
  const mergeAudioFiles = async (pathA, pathB, outputPath) => {
    try {
      console.log('[Audio] Merging audio files...');

      // Get file info
      const infoA = await RNFS.stat(pathA);
      const infoB = await RNFS.stat(pathB);

      const samplesA = Math.floor((infoA.size - 44) / 2);
      const samplesB = Math.floor((infoB.size - 44) / 2);
      const maxSamples = Math.max(samplesA, samplesB);

      console.log(`[Audio] Merging: A=${samplesA} samples, B=${samplesB} samples`);

      // Create WAV header for merged file
      const bytesPerSecond = SAMPLE_RATE * BYTES_PER_SAMPLE * NUM_CHANNELS;
      const dataLen = maxSamples * 2;
      const header = new Uint8Array(44);
      [0x52,0x49,0x46,0x46].forEach((v,i) => header[i] = v);
      const fileSize = 36 + dataLen;
      header[4] = fileSize & 0xFF; header[5] = (fileSize >> 8) & 0xFF;
      header[6] = (fileSize >> 16) & 0xFF; header[7] = (fileSize >> 24) & 0xFF;
      [0x57,0x41,0x56,0x45,0x66,0x6D,0x74,0x20].forEach((v,i) => header[8+i] = v);
      [16,0,0,0,1,0,1,0].forEach((v,i) => header[16+i] = v);
      header[24] = SAMPLE_RATE & 0xFF; header[25] = (SAMPLE_RATE >> 8) & 0xFF;
      header[26] = (SAMPLE_RATE >> 16) & 0xFF; header[27] = (SAMPLE_RATE >> 24) & 0xFF;
      header[28] = bytesPerSecond & 0xFF; header[29] = (bytesPerSecond >> 8) & 0xFF;
      header[30] = (bytesPerSecond >> 16) & 0xFF; header[31] = (bytesPerSecond >> 24) & 0xFF;
      header[32] = 2; header[33] = 0; header[34] = 16; header[35] = 0;
      [0x64,0x61,0x74,0x61].forEach((v,i) => header[36+i] = v);
      header[40] = dataLen & 0xFF; header[41] = (dataLen >> 8) & 0xFF;
      header[42] = (dataLen >> 16) & 0xFF; header[43] = (dataLen >> 24) & 0xFF;

      // Write header
      await RNFS.writeFile(outputPath, uint8ArrayToBase64(header), 'base64');

      // Process in chunks to avoid OOM
      const CHUNK_SAMPLES = 100000;
      let processedSamples = 0;

      while (processedSamples < maxSamples) {
        const samplesToProcess = Math.min(CHUNK_SAMPLES, maxSamples - processedSamples);
        const bytesToRead = samplesToProcess * 2;
        const offset = 44 + processedSamples * 2;

        // Read chunks from both files
        let samplesAData = new Int16Array(samplesToProcess);
        let samplesBData = new Int16Array(samplesToProcess);

        if (processedSamples < samplesA) {
          const readLen = Math.min(bytesToRead, (samplesA - processedSamples) * 2);
          const chunkA = await RNFS.read(pathA, readLen, offset, 'base64');
          const bytesA = base64ToUint8Array(chunkA);
          for (let i = 0; i < bytesA.length / 2; i++) {
            samplesAData[i] = bytesA[i * 2] | (bytesA[i * 2 + 1] << 8);
            if (samplesAData[i] > 32767) samplesAData[i] -= 65536;
          }
        }

        if (processedSamples < samplesB) {
          const readLen = Math.min(bytesToRead, (samplesB - processedSamples) * 2);
          const chunkB = await RNFS.read(pathB, readLen, offset, 'base64');
          const bytesB = base64ToUint8Array(chunkB);
          for (let i = 0; i < bytesB.length / 2; i++) {
            samplesBData[i] = bytesB[i * 2] | (bytesB[i * 2 + 1] << 8);
            if (samplesBData[i] > 32767) samplesBData[i] -= 65536;
          }
        }

        // Mix samples (average to avoid clipping)
        const mixed = new Uint8Array(samplesToProcess * 2);
        for (let i = 0; i < samplesToProcess; i++) {
          const mixedSample = Math.round((samplesAData[i] + samplesBData[i]) / 2);
          const clamped = Math.max(-32768, Math.min(32767, mixedSample));
          mixed[i * 2] = clamped & 0xFF;
          mixed[i * 2 + 1] = (clamped >> 8) & 0xFF;
        }

        // Append to output
        await RNFS.appendFile(outputPath, uint8ArrayToBase64(mixed), 'base64');
        processedSamples += samplesToProcess;
      }

      console.log(`[Audio] Merged audio saved: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('[Audio] Merge error:', error);
      return null;
    }
  };

  const cutWavChunk = async (inputPath, startTime, endTime) => {
    try {
      const bytesPerSecond = SAMPLE_RATE * BYTES_PER_SAMPLE * NUM_CHANNELS;

      // Calculate byte offsets for the chunk
      const startOffset = Math.floor(startTime * bytesPerSecond);
      const endOffset = Math.floor(endTime * bytesPerSecond);
      const dataLength = endOffset - startOffset;

      if (dataLength <= 0) return null;

      // Only read the specific portion of the file we need (not the whole file!)
      const chunkBase64 = await RNFS.read(inputPath, dataLength, 44 + startOffset, 'base64');
      const chunkBytes = base64ToUint8Array(chunkBase64);

      // Create WAV header
      const newWav = new Uint8Array(44 + chunkBytes.length);
      [0x52,0x49,0x46,0x46].forEach((v,i) => newWav[i] = v);
      const fileSize = 36 + chunkBytes.length;
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
      newWav[40] = chunkBytes.length & 0xFF; newWav[41] = (chunkBytes.length >> 8) & 0xFF;
      newWav[42] = (chunkBytes.length >> 16) & 0xFF; newWav[43] = (chunkBytes.length >> 24) & 0xFF;

      // Copy audio data
      for (let i = 0; i < chunkBytes.length; i++) newWav[44 + i] = chunkBytes[i];

      const outPath = `${RNFS.DocumentDirectoryPath}/chunk_${startTime}_${endTime}.wav`;
      await RNFS.writeFile(outPath, uint8ArrayToBase64(newWav), 'base64');
      return outPath;
    } catch (e) {
      console.error('[WAV] Cut error:', e);
      return null;
    }
  };

  // Find longest common substring between end of str1 and start of str2
  const findOverlapMatch = (str1, str2, maxLen = 20) => {
    if (!str1 || !str2) return 0;
    const searchLen = Math.min(maxLen, str1.length, str2.length);
    for (let len = searchLen; len >= 2; len--) {
      const suffix = str1.slice(-len);
      const idx = str2.indexOf(suffix);
      if (idx >= 0 && idx < len) {
        return idx + len;
      }
    }
    return 0;
  };

  // ============== SIMPLE ENERGY-BASED VAD ==============
  // Detect speech segments by analyzing audio energy (chunked for large files)
  // Using larger windows for faster processing of long audio files
  const VAD_WINDOW_MS = 250; // 250ms analysis window (faster, less granular)
  const VAD_ENERGY_THRESHOLD = 0.005; // Lower threshold to capture quieter speech
  const VAD_MIN_SPEECH_MS = 500; // Minimum 500ms speech duration (filter short noise)
  const VAD_MIN_SILENCE_MS = 500; // Minimum silence to split segments
  const VAD_PADDING_MS = 200; // Padding around speech segments

  const detectSpeechSegments = async (filePath) => {
    console.log('[VAD] Analyzing audio file (chunked)...');

    // Get file size first
    const fileInfo = await RNFS.stat(filePath);
    const fileSize = fileInfo.size;
    const dataLen = fileSize - 44;
    const numSamples = Math.floor(dataLen / 2);

    // Calculate RMS energy for each window (process in chunks to avoid OOM)
    const windowSamples = Math.floor((VAD_WINDOW_MS / 1000) * SAMPLE_RATE);
    const numWindows = Math.floor(numSamples / windowSamples);

    console.log(`[VAD] File size: ${(fileSize / 1024 / 1024).toFixed(1)}MB, ${numWindows} windows`);

    // Process in chunks of 2M samples (~4MB per chunk, ~64s of audio)
    // This reduces file I/O while staying within memory limits
    const CHUNK_SAMPLES = 2000000;
    const energies = [];
    let processedSamples = 0;

    const totalChunks = Math.ceil(numSamples / CHUNK_SAMPLES);
    console.log(`[VAD] Processing ${totalChunks} chunks...`);

    while (processedSamples < numSamples) {
      const samplesToRead = Math.min(CHUNK_SAMPLES, numSamples - processedSamples);
      const bytesToRead = samplesToRead * 2;
      const offset = 44 + processedSamples * 2;

      // Read chunk
      const chunkBase64 = await RNFS.read(filePath, bytesToRead, offset, 'base64');
      const chunkBytes = base64ToUint8Array(chunkBase64);

      // Parse and calculate energy for windows in this chunk (subsampled for speed)
      const windowsInChunk = Math.floor(samplesToRead / windowSamples);
      const SUBSAMPLE = 8; // Only check every 8th sample for speed
      const actualSamplesPerWindow = Math.floor(windowSamples / SUBSAMPLE);

      for (let w = 0; w < windowsInChunk; w++) {
        let sum = 0;
        for (let i = 0; i < windowSamples; i += SUBSAMPLE) {
          const sampleIdx = w * windowSamples + i;
          const sample = (chunkBytes[sampleIdx * 2] | (chunkBytes[sampleIdx * 2 + 1] << 8));
          // Convert to signed
          const signedSample = sample > 32767 ? sample - 65536 : sample;
          const normalized = signedSample / 32768;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / actualSamplesPerWindow);
        energies.push(rms);
      }

      processedSamples += windowsInChunk * windowSamples;
    }

    console.log(`[VAD] Calculated energy for ${energies.length} windows`);

    // Find speech segments based on energy threshold
    const speechWindows = energies.map(e => e > VAD_ENERGY_THRESHOLD);

    // Merge adjacent speech windows and detect segments
    const segments = [];
    let inSpeech = false;
    let speechStart = 0;
    let silenceCount = 0;
    const minSpeechWindows = Math.ceil(VAD_MIN_SPEECH_MS / VAD_WINDOW_MS);
    const minSilenceWindows = Math.ceil(VAD_MIN_SILENCE_MS / VAD_WINDOW_MS);
    const paddingWindows = Math.ceil(VAD_PADDING_MS / VAD_WINDOW_MS);

    for (let w = 0; w < speechWindows.length; w++) {
      if (speechWindows[w]) {
        if (!inSpeech) {
          speechStart = Math.max(0, w - paddingWindows);
          inSpeech = true;
        }
        silenceCount = 0;
      } else if (inSpeech) {
        silenceCount++;
        if (silenceCount >= minSilenceWindows) {
          const speechEnd = Math.min(w + paddingWindows, speechWindows.length);
          const durationWindows = speechEnd - speechStart;
          if (durationWindows >= minSpeechWindows) {
            segments.push({
              start: (speechStart * VAD_WINDOW_MS) / 1000,
              end: (speechEnd * VAD_WINDOW_MS) / 1000,
            });
          }
          inSpeech = false;
          silenceCount = 0;
        }
      }
    }

    // Handle last segment
    if (inSpeech) {
      const speechEnd = speechWindows.length;
      const durationWindows = speechEnd - speechStart;
      if (durationWindows >= minSpeechWindows) {
        segments.push({
          start: (speechStart * VAD_WINDOW_MS) / 1000,
          end: (speechEnd * VAD_WINDOW_MS) / 1000,
        });
      }
    }

    console.log(`[VAD] Detected ${segments.length} speech segments`);
    segments.slice(0, 10).forEach((s, i) => console.log(`  [${i}] ${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s`));
    if (segments.length > 10) console.log(`  ... and ${segments.length - 10} more`);
    return segments;
  };

  // Transcribe using VAD-detected segments (for short files) or time-based chunks (for long files)
  const MAX_VAD_DURATION = 10; // Use chunking for most files (faster than VAD)

  const transcribeWithVAD = async (filePath, speaker, baseOffset = 0) => {
    // Get file duration from size (16kHz, 16-bit mono = 32000 bytes per second)
    const fileInfo = await RNFS.stat(filePath);
    const fileDuration = (fileInfo.size - 44) / 32000;

    console.log(`[Transcribe] File duration: ${fileDuration.toFixed(1)}s`);

    // For long files, use simple time-based chunking instead of VAD
    if (fileDuration > MAX_VAD_DURATION) {
      console.log(`[Transcribe] Using time-based chunking for long file`);
      return await transcribeFileInChunks(filePath, fileDuration, speaker, baseOffset);
    }

    // For short files, use VAD
    const vadSegments = await detectSpeechSegments(filePath);
    const results = [];

    for (let i = 0; i < vadSegments.length; i++) {
      const seg = vadSegments[i];
      setTranscribeStatus(`${speaker === 'A' ? 'オペレーター' : 'お客様'} セグメント ${i + 1}/${vadSegments.length}...`);

      const chunkPath = await cutWavChunk(filePath, seg.start, seg.end);
      if (chunkPath) {
        const text = await transcribeFile(chunkPath);
        console.log(`[VAD Seg ${i}] ${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s: "${text}"`);

        if (text && text.trim()) {
          results.push({
            text: text.trim(),
            startTime: baseOffset + seg.start,
            endTime: baseOffset + seg.end,
            speaker,
          });
        }
        await RNFS.unlink(chunkPath).catch(() => {});
      }
    }

    return results;
  };

  // Transcribe file in chunks - returns array of {text, startTime, endTime}
  // Using smaller chunks (3s) to capture more detail
  const transcribeFileInChunks = async (filePath, totalDuration, speaker, baseOffset = 0) => {
    const segments = [];

    // Use smaller chunks (3s) to capture more speech content
    // Model might miss content with larger chunks
    const SHORT_CHUNK = 3;
    const step = 2; // 1s overlap to catch words at boundaries

    const totalChunks = Math.ceil(totalDuration / step);
    console.log(`[Chunk] Processing ${totalDuration.toFixed(0)}s audio, ~${totalChunks} chunks`);

    console.log(`[Chunk] Processing ${totalDuration.toFixed(0)}s audio with ${SHORT_CHUNK}s chunks, step ${step.toFixed(1)}s`);

    let lastText = '';
    let chunkIdx = 0;
    for (let start = 0; start < totalDuration; start += step) {
      chunkIdx++;
      // Update status every 10 chunks
      if (chunkIdx % 10 === 1) {
        const progress = Math.floor((start / totalDuration) * 100);
        setTranscribeStatus(`${speaker === 'A' ? 'オペレーター' : 'お客様'} ${progress}%...`);
      }
      const end = Math.min(start + SHORT_CHUNK, totalDuration);
      const chunkPath = await cutWavChunk(filePath, start, end);

      if (chunkPath) {
        let text = await transcribeFile(chunkPath);
        console.log(`[Chunk ${start.toFixed(1)}-${end.toFixed(1)}s] "${text}"`);

        // Remove duplicate content from overlap
        if (text && lastText) {
          const cutPos = findOverlapMatch(lastText, text);
          if (cutPos > 0) {
            text = text.slice(cutPos);
          }
        }

        if (text && text.trim()) {
          segments.push({
            text: text.trim(),
            startTime: baseOffset + start,
            endTime: baseOffset + Math.min(end, totalDuration),
            speaker
          });
          lastText = text.trim();
        }
        await RNFS.unlink(chunkPath).catch(() => {});
      }
    }
    console.log(`[Chunk] Total: ${segments.length} segments with text`);
    return segments;
  };

  const transcribeAudio = async () => {
    if (!modelReady) return;

    setIsTranscribing(true);
    setTranscribeStatus('音声ダウンロード中...');

    const startTime = Date.now();

    try {
      setTranscribeStatus('オペレーター音声ダウンロード中...');
      const personAPath = await getAudioFilePath('personA');

      setTranscribeStatus('お客様音声ダウンロード中...');
      const personBPath = !singleSpeaker ? await getAudioFilePath('personB') : null;

      console.log(`[Transcribe] Person A: ${personAPath}`);
      console.log(`[Transcribe] Person B: ${personBPath}`);

      let segsA = [], segsB = [];

      // Use VAD to detect speech segments, then transcribe each segment
      if (personAPath) {
        setTranscribeStatus('オペレーター 処理中...');
        segsA = await transcribeWithVAD(personAPath, 'A', 0);
      }

      if (personBPath) {
        setTranscribeStatus('お客様 処理中...');
        segsB = await transcribeWithVAD(personBPath, 'B', PERSON_B_OFFSET);
      }

      // Combine and sort by time
      const allSegs = [...segsA, ...segsB].sort((a, b) => a.startTime - b.startTime);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Transcribe] Done in ${elapsed}s, ${allSegs.length} segments`);

      // Merge audio files for player (if both exist)
      if (personAPath && personBPath) {
        setTranscribeStatus('音声ミックス中...');
        const mergedPath = `${RNFS.DocumentDirectoryPath}/merged_conversation.wav`;
        const merged = await mergeAudioFiles(personAPath, personBPath, mergedPath);
        if (merged) {
          setUrlAudioPath(merged);
          console.log(`[Audio] Player will use merged: ${merged}`);
        } else {
          // Fallback to Person A only
          setUrlAudioPath(personAPath);
          console.log(`[Audio] Player will use Person A: ${personAPath}`);
        }
      } else if (personAPath) {
        setUrlAudioPath(personAPath);
        console.log(`[Audio] Player will use Person A: ${personAPath}`);
      }

      setConversation(allSegs);
      setTranscribeStatus('');
    } catch (error) {
      console.error('[Transcribe] Error:', error);
      Alert.alert('エラー', `文字起こし失敗: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const togglePlay = () => { setIsPlaying(!isPlaying); };
  const onLoad = (data) => { setDuration(data.duration); };
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
      {(urlAudioPath || (activeTrack && AUDIO_FILES[activeTrack])) && (
        <Video
          ref={playerRef}
          source={urlAudioPath ? { uri: urlAudioPath } : AUDIO_FILES[activeTrack].source}
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

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通話履歴詳細</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

          {modelReady && isTranscribing && (
            <View style={styles.transcribeStatusBar}>
              <ActivityIndicator color="#1a7a6d" size="small" />
              <Text style={styles.transcribeStatusText}>{transcribeStatus || '処理中...'}</Text>
            </View>
          )}

          {isModelLoading && (
             <View style={styles.transcribeStatusBar}>
               <ActivityIndicator color="#1a7a6d" size="small" />
               <Text style={styles.transcribeStatusText}>モデル初期化中...</Text>
             </View>
          )}
        </View>

        {conversation.length > 0 && (
          <View style={styles.chatSection}>
            <Text style={styles.chatTitle}>通話内容</Text>

            {singleSpeaker ? (
              <View style={styles.paragraphContainer}>
                {conversation.map((item, index) => (
                  <Text key={index} style={styles.paragraphText}>
                    {item.text}
                  </Text>
                ))}
              </View>
            ) : (
              conversation.map((item, index) => (
                <View
                  key={index}
                  style={item.speaker === 'A' ? styles.chatBubbleA : styles.chatBubbleB}
                >
                  <View style={styles.chatHeader}>
                    <Text style={[styles.chatSpeaker, { color: item.speaker === 'A' ? '#1976D2' : '#C2185B' }]}>
                      {item.speaker === 'A' ? 'オペレーター' : 'お客様'}
                    </Text>
                    <Text style={styles.chatTimestamp}>
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </Text>
                  </View>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              ))
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
  chatTimestamp: {
    fontSize: 11,
    color: '#888',
  },
  chatText: {
    fontSize: 15,
    color: '#222',
    lineHeight: 22,
  },
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
});

export default CallDetailScreen;
