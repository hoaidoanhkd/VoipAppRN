import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme/colors';
import Video from 'react-native-video';
import { initWhisper } from 'whisper.rn';
import RNFS from 'react-native-fs';

// Model URL for Whisper (small model for better Japanese recognition)
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';
const MODEL_FILENAME = 'ggml-small.bin';

// 3 audio files:
// 1. Person A: speaks + silence (26s)
// 2. Person B: silence + speaks (26s)
// 3. Merged: both combined (26s)

const AUDIO_FILES = {
  personA: {
    name: 'Person A - 山田さん',
    source: require('../assets/audio/person_a_final.wav'),
    color: '#1976D2',
    description: 'Nói 4 câu + im lặng khi B nói',
  },
  personB: {
    name: 'Person B - 田中さん',
    source: require('../assets/audio/person_b_final.wav'),
    color: '#C2185B',
    description: 'Im lặng khi A nói + nói 4 câu',
  },
  merged: {
    name: 'Merged Audio',
    source: require('../assets/audio/merged_conversation.wav'),
    color: '#4CAF50',
    description: 'Cả 2 người gộp lại',
  },
};


const AudioTrackPlayer = ({ trackKey, track, isActive, onPlay, currentTime, duration, isPlaying, onTranscribe, isTranscribing, transcriptionResult, modelReady }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.trackCard, isActive && { borderColor: track.color, borderWidth: 2 }]}>
      <View style={styles.trackHeader}>
        <View style={[styles.trackIcon, { backgroundColor: track.color }]}>
          <Text style={styles.trackIconText}>
            {trackKey === 'personA' ? '👨' : trackKey === 'personB' ? '👩' : '🎵'}
          </Text>
        </View>
        <View style={styles.trackInfo}>
          <Text style={styles.trackName}>{track.name}</Text>
          <Text style={styles.trackDesc}>{track.description}</Text>
        </View>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: track.color }]}
          onPress={() => onPlay(trackKey)}
        >
          <Text style={styles.playBtnText}>
            {isActive && isPlaying ? '⏸️' : '▶️'}
          </Text>
        </TouchableOpacity>
      </View>

      {isActive && (
        <View style={styles.progressRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <View style={styles.progressBarSmall}>
            <View
              style={[
                styles.progressFillSmall,
                { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, backgroundColor: track.color }
              ]}
            />
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      )}

      {/* Transcribe Button */}
      {modelReady && (
        <TouchableOpacity
          style={[styles.transcribeBtn, { backgroundColor: track.color }]}
          onPress={() => onTranscribe(trackKey)}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.transcribeBtnText}>🎙️ Transcribe</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Transcription Result */}
      {transcriptionResult && (
        <View style={styles.transcriptionResult}>
          <Text style={styles.transcriptionLabel}>📝 Transcription:</Text>
          <Text style={styles.transcriptionText}>{transcriptionResult}</Text>
        </View>
      )}
    </View>
  );
};

const RecordingsScreen = () => {
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Whisper states
  const [whisperContext, setWhisperContext] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState({});
  const [modelReady, setModelReady] = useState(false);
  const [conversation, setConversation] = useState([]); // Array of {speaker, text, startTime, endTime}
  const [segmentsA, setSegmentsA] = useState([]); // Segments from Person A
  const [segmentsB, setSegmentsB] = useState([]); // Segments from Person B

  // Merge segments from A and B, sort by timestamp
  const mergeConversation = (segsA, segsB) => {
    const allSegments = [
      ...segsA.map(s => ({ ...s, speaker: 'A' })),
      ...segsB.map(s => ({ ...s, speaker: 'B' })),
    ];
    // Sort by start time
    allSegments.sort((a, b) => a.startTime - b.startTime);
    return allSegments;
  };

  const playerRef = useRef(null);

  // Initialize Whisper model
  useEffect(() => {
    checkAndLoadModel();
    return () => {
      if (whisperContext) {
        whisperContext.release();
      }
    };
  }, []);

  // Auto-merge conversation when both A and B have segments
  useEffect(() => {
    if (segmentsA.length > 0 && segmentsB.length > 0) {
      const merged = mergeConversation(segmentsA, segmentsB);
      setConversation(merged);
    }
  }, [segmentsA, segmentsB]);

  const getModelPath = () => {
    return `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
  };

  const checkAndLoadModel = async () => {
    const modelPath = getModelPath();
    const exists = await RNFS.exists(modelPath);

    if (exists) {
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
          const progress = (res.bytesWritten / res.contentLength) * 100;
          setModelProgress(Math.round(progress));
        },
        progressDivider: 1,
      });

      const result = await downloadResult.promise;

      if (result.statusCode === 200) {
        await initializeWhisper(modelPath);
      } else {
        Alert.alert('Error', 'Failed to download model');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', `Download failed: ${error.message}`);
    } finally {
      setIsModelLoading(false);
    }
  };

  const initializeWhisper = async (modelPath) => {
    try {
      setIsModelLoading(true);
      const context = await initWhisper({ filePath: modelPath });
      setWhisperContext(context);
      setModelReady(true);
      setIsModelLoading(false);
    } catch (error) {
      console.error('Whisper init error:', error);
      Alert.alert('Error', `Failed to initialize Whisper: ${error.message}`);
      setIsModelLoading(false);
    }
  };

  const getAudioFilePath = async (trackKey) => {
    const audioSource = AUDIO_FILES[trackKey].source;
    const destPath = `${RNFS.DocumentDirectoryPath}/${trackKey}.wav`;

    // Check if already exists
    const exists = await RNFS.exists(destPath);
    if (exists) {
      return destPath;
    }

    try {
      // Get the resolved asset URI
      const resolved = Image.resolveAssetSource(audioSource);
      console.log('Resolved asset:', resolved);

      if (!resolved || !resolved.uri) {
        console.error('Could not resolve asset');
        return null;
      }

      const uri = resolved.uri;

      // During development, Metro serves assets via HTTP
      if (uri.startsWith('http')) {
        console.log('Downloading from Metro:', uri);
        const downloadResult = await RNFS.downloadFile({
          fromUrl: uri,
          toFile: destPath,
        }).promise;

        if (downloadResult.statusCode === 200) {
          console.log('Downloaded to:', destPath);
          return destPath;
        }
      }
      // In production, assets are in the bundle
      else if (uri.startsWith('file://')) {
        const sourcePath = uri.replace('file://', '');
        await RNFS.copyFile(sourcePath, destPath);
        return destPath;
      }
      // For iOS bundle assets
      else {
        const bundlePath = `${RNFS.MainBundlePath}/${uri}`;
        if (await RNFS.exists(bundlePath)) {
          await RNFS.copyFile(bundlePath, destPath);
          return destPath;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting audio path:', error);
      Alert.alert('Debug', `Error: ${error.message}`);
      return null;
    }
  };

  const transcribeAudio = async (trackKey) => {
    if (!whisperContext) {
      Alert.alert('Model not ready', 'Please download the Whisper model first');
      return;
    }

    setIsTranscribing(true);

    try {
      console.log('Starting transcription for:', trackKey);
      const audioPath = await getAudioFilePath(trackKey);
      console.log('Audio path:', audioPath);

      if (!audioPath) {
        Alert.alert('Error', 'Could not find audio file');
        setIsTranscribing(false);
        return;
      }

      // Check if file exists
      const fileExists = await RNFS.exists(audioPath);
      console.log('File exists:', fileExists);

      if (!fileExists) {
        Alert.alert('Error', 'Audio file does not exist at path');
        setIsTranscribing(false);
        return;
      }

      // Transcribe using Whisper with segments
      console.log('Starting Whisper transcription...');
      const { promise } = whisperContext.transcribe(audioPath, {
        language: 'ja', // Japanese
        maxLen: 0, // No max length limit per segment
        tokenTimestamps: true,
        wordTimestamps: true,
      });

      const transcribeResult = await promise;
      console.log('Transcription result:', JSON.stringify(transcribeResult, null, 2));

      // Parse segments with timestamps
      const segments = transcribeResult?.segments || [];
      const parsedSegments = segments.map(segment => ({
        text: segment.text?.trim() || '',
        startTime: (segment.t0 || 0) / 100, // t0 is in centiseconds
        endTime: (segment.t1 || 0) / 100,
      })).filter(item => item.text && item.text !== '(音楽)' && item.text !== '');

      console.log(`Parsed segments for ${trackKey}:`, parsedSegments);

      // Store segments based on track
      if (trackKey === 'personA') {
        setSegmentsA(parsedSegments);
        // If B already has segments, merge them
        if (segmentsB.length > 0) {
          const merged = mergeConversation(parsedSegments, segmentsB);
          setConversation(merged);
        }
      } else if (trackKey === 'personB') {
        setSegmentsB(parsedSegments);
        // If A already has segments, merge them
        if (segmentsA.length > 0) {
          const merged = mergeConversation(segmentsA, parsedSegments);
          setConversation(merged);
        }
      } else if (trackKey === 'merged') {
        // For merged, we can't distinguish speakers without the individual files
        // Just show the transcription as-is
      }

      const text = transcribeResult?.result || transcribeResult?.text ||
        (segments.map(s => s.text).join(' ')) ||
        JSON.stringify(transcribeResult);

      setTranscriptionResults(prev => ({
        ...prev,
        [trackKey]: text || 'No transcription result',
      }));

    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', `Transcription failed: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handlePlay = (trackKey) => {
    if (activeTrack === trackKey) {
      // Toggle play/pause
      setIsPlaying(!isPlaying);
    } else {
      // Switch track
      setActiveTrack(trackKey);
      setIsPlaying(true);
      setCurrentTime(0);
    }
  };

  const onLoad = (data) => {
    setDuration(data.duration);
  };

  const onProgress = (data) => {
    setCurrentTime(data.currentTime);
  };

  const onEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Audio Player</Text>
      <Text style={styles.subtitle}>
        3 file audio - mỗi người 26s (có âm câm)
      </Text>

      {/* Hidden audio player */}
      {activeTrack && (
        <Video
          ref={playerRef}
          source={AUDIO_FILES[activeTrack].source}
          paused={!isPlaying}
          volume={1.0}
          onLoad={onLoad}
          onProgress={onProgress}
          onEnd={onEnd}
          audioOnly={true}
          playInBackground={true}
          playWhenInactive={true}
          progressUpdateInterval={250}
          style={styles.hiddenPlayer}
        />
      )}

      {/* Whisper Model Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🤖 Speech-to-Text (Whisper)</Text>

        {!modelReady ? (
          <View style={styles.modelSection}>
            <Text style={styles.modelInfo}>
              Tải model Whisper Small (~466MB) để chuyển audio thành text tiếng Nhật
            </Text>
            <TouchableOpacity
              style={[styles.downloadBtn, isModelLoading && styles.downloadBtnDisabled]}
              onPress={downloadModel}
              disabled={isModelLoading}
            >
              {isModelLoading ? (
                <View style={styles.downloadProgress}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.downloadBtnText}>
                    Downloading... {modelProgress}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.downloadBtnText}>⬇️ Download Model</Text>
              )}
            </TouchableOpacity>
            {isModelLoading && (
              <View style={styles.progressBarDownload}>
                <View
                  style={[styles.progressFillDownload, { width: `${modelProgress}%` }]}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.modelReady}>
            <Text style={styles.modelReadyText}>✅ Model sẵn sàng</Text>
            <Text style={styles.modelHint}>
              Transcribe cả Person A và Person B để xem cuộc hội thoại
            </Text>
            {segmentsA.length > 0 && segmentsB.length === 0 && (
              <Text style={styles.modelHintProgress}>✅ A đã xong • ⏳ Đang chờ B...</Text>
            )}
            {segmentsB.length > 0 && segmentsA.length === 0 && (
              <Text style={styles.modelHintProgress}>⏳ Đang chờ A... • ✅ B đã xong</Text>
            )}
            {segmentsA.length > 0 && segmentsB.length > 0 && (
              <Text style={styles.modelHintProgress}>✅ Đã merge {conversation.length} câu!</Text>
            )}
          </View>
        )}
      </View>

      {/* Audio Files Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎧 Audio Files (26s mỗi file)</Text>

        <AudioTrackPlayer
          trackKey="personA"
          track={AUDIO_FILES.personA}
          isActive={activeTrack === 'personA'}
          onPlay={handlePlay}
          currentTime={activeTrack === 'personA' ? currentTime : 0}
          duration={activeTrack === 'personA' ? duration : 0}
          isPlaying={activeTrack === 'personA' && isPlaying}
          onTranscribe={transcribeAudio}
          isTranscribing={isTranscribing}
          transcriptionResult={transcriptionResults.personA}
          modelReady={modelReady}
        />

        <AudioTrackPlayer
          trackKey="personB"
          track={AUDIO_FILES.personB}
          isActive={activeTrack === 'personB'}
          onPlay={handlePlay}
          currentTime={activeTrack === 'personB' ? currentTime : 0}
          duration={activeTrack === 'personB' ? duration : 0}
          isPlaying={activeTrack === 'personB' && isPlaying}
          onTranscribe={transcribeAudio}
          isTranscribing={isTranscribing}
          transcriptionResult={transcriptionResults.personB}
          modelReady={modelReady}
        />

        <AudioTrackPlayer
          trackKey="merged"
          track={AUDIO_FILES.merged}
          isActive={activeTrack === 'merged'}
          onPlay={handlePlay}
          currentTime={activeTrack === 'merged' ? currentTime : 0}
          duration={activeTrack === 'merged' ? duration : 0}
          isPlaying={activeTrack === 'merged' && isPlaying}
          onTranscribe={transcribeAudio}
          isTranscribing={isTranscribing}
          transcriptionResult={transcriptionResults.merged}
          modelReady={modelReady}
        />
      </View>

      {/* Conversation Display - from Transcription */}
      {conversation.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Cuộc hội thoại (từ Transcribe)</Text>

          {conversation.map((item, index) => (
            <View
              key={index}
              style={item.speaker === 'A' ? styles.chatBubbleA : styles.chatBubbleB}
            >
              <View style={styles.chatHeader}>
                <Text style={styles.chatLabel}>
                  {item.speaker === 'A' ? '👨 山田さん' : '👩 田中さん'}
                </Text>
                <Text style={styles.chatTime}>
                  {item.startTime.toFixed(1)}s - {item.endTime.toFixed(1)}s
                </Text>
              </View>
              <Text style={styles.chatText}>{item.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Raw Transcription Results */}
      {(transcriptionResults.personA || transcriptionResults.personB || transcriptionResults.merged) && conversation.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Kết quả Transcribe</Text>

          {transcriptionResults.personA && (
            <View style={styles.chatBubbleA}>
              <Text style={styles.chatLabel}>👨 Person A:</Text>
              <Text style={styles.chatText}>{transcriptionResults.personA}</Text>
            </View>
          )}

          {transcriptionResults.personB && (
            <View style={styles.chatBubbleB}>
              <Text style={styles.chatLabel}>👩 Person B:</Text>
              <Text style={styles.chatText}>{transcriptionResults.personB}</Text>
            </View>
          )}

          {transcriptionResults.merged && (
            <View style={styles.chatBubbleMerged}>
              <Text style={styles.chatLabel}>🎵 Merged:</Text>
              <Text style={styles.chatText}>{transcriptionResults.merged}</Text>
            </View>
          )}
        </View>
      )}

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Giải thích</Text>
        <View style={styles.infoRow}>
          <View style={[styles.infoDot, { backgroundColor: '#1976D2' }]} />
          <Text style={styles.infoText}>Person A: [nói] [im] [nói] [im] [nói] [im] [nói] [im]</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={[styles.infoDot, { backgroundColor: '#C2185B' }]} />
          <Text style={styles.infoText}>Person B: [im] [nói] [im] [nói] [im] [nói] [im] [nói]</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={[styles.infoDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.infoText}>Merged: A + B overlay = cuộc hội thoại</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  hiddenPlayer: {
    width: 0,
    height: 0,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  trackCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  trackIconText: {
    fontSize: 22,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  trackDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressBarSmall: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 36,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  infoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  infoText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  // Chat bubble styles
  chatBubbleA: {
    backgroundColor: '#E3F2FD',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    marginRight: Spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  chatBubbleB: {
    backgroundColor: '#FCE4EC',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: '#C2185B',
  },
  chatBubbleMerged: {
    backgroundColor: '#E8F5E9',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  chatLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  chatTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chatText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  // Model download styles
  modelSection: {
    alignItems: 'center',
  },
  modelInfo: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  downloadBtn: {
    backgroundColor: '#6200EE',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 200,
    alignItems: 'center',
  },
  downloadBtnDisabled: {
    backgroundColor: '#9E9E9E',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBarDownload: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginTop: Spacing.sm,
    width: '100%',
    overflow: 'hidden',
  },
  progressFillDownload: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 3,
  },
  modelReady: {
    alignItems: 'center',
  },
  modelReadyText: {
    fontSize: FontSize.md,
    color: '#4CAF50',
    fontWeight: '600',
  },
  modelHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  modelHintProgress: {
    fontSize: FontSize.xs,
    color: '#1976D2',
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  // Transcribe button styles
  transcribeBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  transcribeBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  // Transcription result styles
  transcriptionResult: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#6200EE',
  },
  transcriptionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  transcriptionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
});

export default RecordingsScreen;
