#!/bin/bash

# Create call center conversation audio files using AIVISpeech
# Operator (person_a) - Male voice: 阿井田 茂 (id: 1310138976)
# Customer (person_b) - Female voice: まお (id: 888753760)

AUDIO_DIR="/Users/apple/Desktop/Projects/NewTest/VoipAppRN/src/assets/audio"
TEMP_DIR="$AUDIO_DIR/temp_tts"
API_URL="http://localhost:10101"

# Speaker IDs
OPERATOR_ID=1310138976  # 阿井田 茂 (male)
CUSTOMER_ID=888753760   # まお (female)

# Clean up and create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "🎙️ Creating audio with AIVISpeech..."
echo "   Operator voice: 阿井田 茂 (ID: $OPERATOR_ID)"
echo "   Customer voice: まお (ID: $CUSTOMER_ID)"
echo ""

# Function to synthesize speech
synthesize() {
    local text="$1"
    local speaker_id="$2"
    local output="$3"

    echo "   Generating: $output"

    # Step 1: Get audio query
    local query=$(curl -s -X POST \
        "${API_URL}/audio_query?text=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$text'''))")&speaker=${speaker_id}" \
        -H "Content-Type: application/json")

    # Step 2: Synthesize audio
    curl -s -X POST \
        "${API_URL}/synthesis?speaker=${speaker_id}" \
        -H "Content-Type: application/json" \
        -d "$query" \
        --output "$output"
}

echo "📝 Generating Operator lines..."

# Operator lines
synthesize "お電話ありがとうございます。カスタマーサポートの田中です。本日はどのようなご用件でしょうか？" $OPERATOR_ID "$TEMP_DIR/op1.wav"
synthesize "ご不便をおかけして申し訳ございません。ご注文番号をお教えいただけますか？" $OPERATOR_ID "$TEMP_DIR/op2.wav"
synthesize "ありがとうございます。確認いたしますので、少々お待ちください。" $OPERATOR_ID "$TEMP_DIR/op3.wav"
synthesize "お待たせいたしました。確認したところ、現在配送中でございます。明日中にお届けできる予定です。" $OPERATOR_ID "$TEMP_DIR/op4.wav"
synthesize "他にご質問はございますか？" $OPERATOR_ID "$TEMP_DIR/op5.wav"
synthesize "お電話ありがとうございました。失礼いたします。" $OPERATOR_ID "$TEMP_DIR/op6.wav"

echo ""
echo "📝 Generating Customer lines..."

# Customer lines
synthesize "すみません、先週注文した商品がまだ届いていないのですが。" $CUSTOMER_ID "$TEMP_DIR/cu1.wav"
synthesize "はい、注文番号は12345678です。" $CUSTOMER_ID "$TEMP_DIR/cu2.wav"
synthesize "はい、お願いします。" $CUSTOMER_ID "$TEMP_DIR/cu3.wav"
synthesize "分かりました。ありがとうございます。" $CUSTOMER_ID "$TEMP_DIR/cu4.wav"
synthesize "いいえ、大丈夫です。ありがとうございました。" $CUSTOMER_ID "$TEMP_DIR/cu5.wav"

echo ""
echo "📊 Getting audio durations..."

# Function to get duration in seconds
get_duration() {
    ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1" 2>/dev/null
}

# Get all durations
OP1_DUR=$(get_duration "$TEMP_DIR/op1.wav")
CU1_DUR=$(get_duration "$TEMP_DIR/cu1.wav")
OP2_DUR=$(get_duration "$TEMP_DIR/op2.wav")
CU2_DUR=$(get_duration "$TEMP_DIR/cu2.wav")
OP3_DUR=$(get_duration "$TEMP_DIR/op3.wav")
CU3_DUR=$(get_duration "$TEMP_DIR/cu3.wav")
OP4_DUR=$(get_duration "$TEMP_DIR/op4.wav")
CU4_DUR=$(get_duration "$TEMP_DIR/cu4.wav")
OP5_DUR=$(get_duration "$TEMP_DIR/op5.wav")
CU5_DUR=$(get_duration "$TEMP_DIR/cu5.wav")
OP6_DUR=$(get_duration "$TEMP_DIR/op6.wav")

echo "   OP1: ${OP1_DUR}s | CU1: ${CU1_DUR}s"
echo "   OP2: ${OP2_DUR}s | CU2: ${CU2_DUR}s"
echo "   OP3: ${OP3_DUR}s | CU3: ${CU3_DUR}s"
echo "   OP4: ${OP4_DUR}s | CU4: ${CU4_DUR}s"
echo "   OP5: ${OP5_DUR}s | CU5: ${CU5_DUR}s"
echo "   OP6: ${OP6_DUR}s"

# Small pause between turns (0.5 seconds)
PAUSE=0.5

echo ""
echo "🔧 Creating silence files..."

# Create silence generator function
create_silence() {
    local duration=$1
    local output=$2
    ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t "$duration" -ar 24000 -ac 1 "$output" 2>/dev/null
}

# Normalize all audio to same sample rate (24000 Hz for AIVISpeech output)
echo "🔄 Normalizing audio files..."
for f in "$TEMP_DIR"/*.wav; do
    ffmpeg -y -i "$f" -ar 24000 -ac 1 "${f%.wav}_norm.wav" 2>/dev/null
    mv "${f%.wav}_norm.wav" "$f"
done

# Create silences for operator file (silence when customer talks)
SIL_CU1=$(echo "$CU1_DUR + $PAUSE" | bc)
SIL_CU2=$(echo "$CU2_DUR + $PAUSE" | bc)
SIL_CU3=$(echo "$CU3_DUR + $PAUSE" | bc)
SIL_CU4=$(echo "$CU4_DUR + $PAUSE" | bc)
SIL_CU5=$(echo "$CU5_DUR" | bc)

create_silence "$SIL_CU1" "$TEMP_DIR/sil_cu1.wav"
create_silence "$SIL_CU2" "$TEMP_DIR/sil_cu2.wav"
create_silence "$SIL_CU3" "$TEMP_DIR/sil_cu3.wav"
create_silence "$SIL_CU4" "$TEMP_DIR/sil_cu4.wav"
create_silence "$SIL_CU5" "$TEMP_DIR/sil_cu5.wav"
create_silence "$PAUSE" "$TEMP_DIR/pause.wav"

# Create silences for customer file (silence when operator talks)
SIL_OP1=$(echo "$OP1_DUR + $PAUSE" | bc)
SIL_OP2=$(echo "$OP2_DUR + $PAUSE" | bc)
SIL_OP3=$(echo "$OP3_DUR + $PAUSE" | bc)
SIL_OP4=$(echo "$OP4_DUR + $PAUSE" | bc)
SIL_OP5=$(echo "$OP5_DUR + $PAUSE" | bc)

create_silence "$SIL_OP1" "$TEMP_DIR/sil_op1.wav"
create_silence "$SIL_OP2" "$TEMP_DIR/sil_op2.wav"
create_silence "$SIL_OP3" "$TEMP_DIR/sil_op3.wav"
create_silence "$SIL_OP4" "$TEMP_DIR/sil_op4.wav"
create_silence "$SIL_OP5" "$TEMP_DIR/sil_op5.wav"

echo ""
echo "🎵 Building Operator audio (person_a_final.wav)..."

# Build operator file: op1 + pause + sil_cu1 + op2 + pause + sil_cu2 + ...
ffmpeg -y \
    -i "$TEMP_DIR/op1.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_cu1.wav" \
    -i "$TEMP_DIR/op2.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_cu2.wav" \
    -i "$TEMP_DIR/op3.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_cu3.wav" \
    -i "$TEMP_DIR/op4.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_cu4.wav" \
    -i "$TEMP_DIR/op5.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_cu5.wav" \
    -i "$TEMP_DIR/op6.wav" \
    -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a][12:a][13:a][14:a][15:a]concat=n=16:v=0:a=1[out]" \
    -map "[out]" -ar 16000 -ac 1 "$AUDIO_DIR/person_a_final.wav" 2>/dev/null

echo "🎵 Building Customer audio (person_b_final.wav)..."

# Build customer file: sil_op1 + cu1 + pause + sil_op2 + cu2 + ...
ffmpeg -y \
    -i "$TEMP_DIR/sil_op1.wav" \
    -i "$TEMP_DIR/cu1.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_op2.wav" \
    -i "$TEMP_DIR/cu2.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_op3.wav" \
    -i "$TEMP_DIR/cu3.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_op4.wav" \
    -i "$TEMP_DIR/cu4.wav" \
    -i "$TEMP_DIR/pause.wav" \
    -i "$TEMP_DIR/sil_op5.wav" \
    -i "$TEMP_DIR/cu5.wav" \
    -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a][12:a][13:a]concat=n=14:v=0:a=1[out]" \
    -map "[out]" -ar 16000 -ac 1 "$AUDIO_DIR/person_b_final.wav" 2>/dev/null

echo "🔊 Creating merged mono file..."

# Create merged conversation (mono mix)
ffmpeg -y \
    -i "$AUDIO_DIR/person_a_final.wav" \
    -i "$AUDIO_DIR/person_b_final.wav" \
    -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest[out]" \
    -map "[out]" -ar 16000 -ac 1 "$AUDIO_DIR/merged_conversation.wav" 2>/dev/null

echo "🎧 Creating stereo file (L=Operator, R=Customer)..."

# Create stereo file with operator on left channel, customer on right
ffmpeg -y \
    -i "$AUDIO_DIR/person_a_final.wav" \
    -i "$AUDIO_DIR/person_b_final.wav" \
    -filter_complex "[0:a][1:a]amerge=inputs=2,pan=stereo|c0<c0|c1<c1[out]" \
    -map "[out]" -ar 16000 "$AUDIO_DIR/stereo_conversation.wav" 2>/dev/null

echo ""
echo "🧹 Cleaning up temp files..."
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Audio files created successfully!"
echo ""
echo "📁 Output files:"
ls -lh "$AUDIO_DIR"/*.wav

echo ""
echo "📊 File durations:"
for f in "$AUDIO_DIR"/*.wav; do
    dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null)
    echo "   $(basename "$f"): ${dur}s"
done

echo ""
echo "🎯 Conversation structure:"
echo "   1. [OP] お電話ありがとうございます..."
echo "   2. [CU] すみません、先週注文した商品が..."
echo "   3. [OP] ご不便をおかけして..."
echo "   4. [CU] はい、注文番号は..."
echo "   5. [OP] ありがとうございます..."
echo "   6. [CU] はい、お願いします"
echo "   7. [OP] お待たせいたしました..."
echo "   8. [CU] 分かりました..."
echo "   9. [OP] 他にご質問は..."
echo "  10. [CU] いいえ、大丈夫です..."
echo "  11. [OP] お電話ありがとうございました..."
