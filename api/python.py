import os
import tempfile
from flask import Flask, jsonify, request
from pydub import AudioSegment
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
import torch
import librosa
from flask_cors import CORS
import requests
from googletrans import Translator

app = Flask(__name__)
CORS(app)

DEEPAI_KEY = '5f7616ea-f6d5-432b-a5c1-44a03ab5f387'

print("DEEPAI_API_KEY:", DEEPAI_KEY)

FFMPEG_PATH = 'C:/ffmpeg/bin/ffmpeg.exe'
AudioSegment.converter = FFMPEG_PATH
print("Configured FFmpeg path:", FFMPEG_PATH)

processor = Wav2Vec2Processor.from_pretrained("bayartsogt/wav2vec2-large-xlsr-mongolian")
model = Wav2Vec2ForCTC.from_pretrained("bayartsogt/wav2vec2-large-xlsr-mongolian")
print("Loaded models for speech processing.")

@app.route("/upload-audio", methods=["POST"])
def upload_audio():
    print("Received request to upload audio.")
    if 'file' not in request.files:
        print("No file part in request.")
        return jsonify({'error': 'No file part'})

    file = request.files['file']
    if file.filename == '':
        print("No selected file.")
        return jsonify({'error': 'No selected file'})

    if file.filename.endswith('.m4a'):
        m4a_audio = AudioSegment.from_file(file, format="m4a")
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            m4a_audio.export(tmp_file.name, format="wav")
            print(f"Converted M4A file to WAV format: {tmp_file.name}")
            result = process_audio(tmp_file.name)
            return jsonify(result)
    elif file.filename.endswith('.wav'):
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                file.save(tmp_file.name)
                print(f"Saved uploaded file to temporary file {tmp_file.name}")
                result = process_audio(tmp_file.name)
                return jsonify(result)
        finally:
            if tmp_file.name:
                os.unlink(tmp_file.name)
                print(f"Deleted temporary file {tmp_file.name}")
    else:
        print("Invalid file type.")
        return jsonify({'error': 'Invalid file type'})

def process_audio(audio_file_path):
    print(f"Processing audio file at {audio_file_path}")
    transcription = speech_to_text(audio_file_path)
    translated_text = translate_text(transcription)
    image_url = generate_image_from_text(translated_text)
    return {'transcription': transcription, 'image_url': image_url}

def speech_to_text(audio_file):
    print("Converting speech to text.")
    speech, rate = librosa.load(audio_file, sr=16000)
    input_values = processor(speech, return_tensors="pt", padding="longest").input_values
    with torch.no_grad():
        logits = model(input_values).logits
    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    print("Transcribed text:", transcription)
    return transcription

def translate_text(mongolian_text):
    print("Translating text.")
    translator = Translator()
    translated_text = translator.translate(mongolian_text, src='mn', dest='en').text
    print("Translated text to English:", translated_text)
    return translated_text

def generate_image_from_text(text):
    print("Generating image from text.")
    response = requests.post(
        "https://api.deepai.org/api/text2img",
        data={'text': text},
        headers={'api-key': DEEPAI_KEY}
    )
    
    try:
        response_json = response.json()
    except ValueError as e:
        error_message = f"Failed to parse JSON response: {str(e)}"
        print(error_message)
        raise Exception(error_message)
    
    if response.status_code != 200:
        error_message = f"API request failed with status code {response.status_code}: {response_json.get('error', 'No error information')}"
        print(error_message)
        raise Exception(error_message)
    
    if 'output_url' in response_json:
        print("Generated image URL:", response_json['output_url'])
        return response_json['output_url']
    else:
        error_message = f"Failed to generate image: {response_json.get('error', 'No error information')}, Full response: {response_json}"
        print(error_message)
        raise Exception(error_message)

if __name__ == "__main__":
    app.run(debug=True)
