from flask import Flask, render_template_string, request, send_file, jsonify
import os
import subprocess
import tempfile

app = Flask(__name__)

HTML = '''
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>אפליקציית חיתוך וידאו</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        #videoPreview {
            width: 400px;
        }
        input[type="number"] {
            width: 80px;
        }
    </style>
</head>
<body>
    <h1>אפליקציית חיתוך וידאו</h1>
    
    <input type="file" id="videoUpload" accept="video/*">
    <br><br>
    
    <video id="videoPreview" controls>
        הדפדפן שלך אינו תומך בתג וידאו.
    </video>
    <br>
    
    <label for="startTime">זמן התחלה (שניות):</label>
    <input type="number" id="startTime" min="0" step="0.1" value="0">
    <br>
    
    <label for="endTime">זמן סיום (שניות):</label>
    <input type="number" id="endTime" min="0" step="0.1" value="0">
    <br><br>
    
    <button id="trimButton">חתוך וידאו</button>
    <button id="downloadButton" disabled>הורד וידאו חתוך</button>

    <script>
        const videoUpload = document.getElementById('videoUpload');
        const videoPreview = document.getElementById('videoPreview');
        const startTime = document.getElementById('startTime');
        const endTime = document.getElementById('endTime');
        const trimButton = document.getElementById('trimButton');
        const downloadButton = document.getElementById('downloadButton');

        videoUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const videoURL = URL.createObjectURL(file);
            videoPreview.src = videoURL;
        });

        videoPreview.addEventListener('loadedmetadata', function() {
            const duration = videoPreview.duration;
            endTime.value = duration.toFixed(1);
        });

        startTime.addEventListener('input', updateVideoPreview);
        endTime.addEventListener('input', updateVideoPreview);

        function updateVideoPreview() {
            videoPreview.currentTime = parseFloat(startTime.value);
        }

        trimButton.addEventListener('click', function() {
            const formData = new FormData();
            formData.append('video', videoUpload.files[0]);
            formData.append('startTime', startTime.value);
            formData.append('endTime', endTime.value);

            fetch('/trim', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('הוידאו נחתך בהצלחה');
                    downloadButton.disabled = false;
                    downloadButton.onclick = function() {
                        window.location.href = '/download/' + data.filename;
                    };
                } else {
                    alert('אירעה שגיאה בחיתוך הוידאו');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('אירעה שגיאה בחיתוך הוידאו');
            });
        });
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/trim', methods=['POST'])
def trim_video():
    video = request.files['video']
    start_time = float(request.form['startTime'])
    end_time = float(request.form['endTime'])

    # שמירת הקובץ המקורי
    _, temp_input = tempfile.mkstemp(suffix='.mp4')
    video.save(temp_input)

    # יצירת שם לקובץ החתוך
    _, temp_output = tempfile.mkstemp(suffix='.mp4')

    # הפעלת FFmpeg
    try:
        subprocess.run([
            'ffmpeg',
            '-i', temp_input,
            '-ss', str(start_time),
            '-to', str(end_time),
            '-c', 'copy',
            temp_output
        ], check=True)
        os.remove(temp_input)  # מחיקת הקובץ המקורי
        return jsonify({'success': True, 'filename': os.path.basename(temp_output)})
    except subprocess.CalledProcessError:
        os.remove(temp_input)
        if os.path.exists(temp_output):
            os.remove(temp_output)
        return jsonify({'success': False})

@app.route('/download/<filename>')
def download(filename):
    directory = tempfile.gettempdir()
    return send_file(os.path.join(directory, filename), as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
