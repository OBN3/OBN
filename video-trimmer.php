<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['video']) && isset($_POST['startTime']) && isset($_POST['endTime'])) {
        $videoPath = $_FILES['video']['tmp_name'];
        $startTime = floatval($_POST['startTime']);
        $endTime = floatval($_POST['endTime']);
        $outputPath = 'trimmed_' . time() . '.mp4';

        $command = "ffmpeg -i $videoPath -ss $startTime -to $endTime -c copy $outputPath";
        $output = shell_exec($command);

        if (file_exists($outputPath)) {
            echo json_encode(['success' => true, 'outputPath' => $outputPath]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to trim video']);
        }
        exit;
    } elseif (isset($_POST['download'])) {
        $file = $_POST['download'];
        if (file_exists($file)) {
            header('Content-Description: File Transfer');
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="'.basename($file).'"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($file));
            readfile($file);
            unlink($file); // מחיקת הקובץ לאחר ההורדה
            exit;
        }
    }
}
?>

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

            fetch('', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('הוידאו נחתך בהצלחה');
                    downloadButton.disabled = false;
                    downloadButton.onclick = function() {
                        const downloadForm = document.createElement('form');
                        downloadForm.method = 'POST';
                        const input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = 'download';
                        input.value = data.outputPath;
                        downloadForm.appendChild(input);
                        document.body.appendChild(downloadForm);
                        downloadForm.submit();
                        document.body.removeChild(downloadForm);
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
