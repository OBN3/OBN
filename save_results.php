<?php
if (isset($_POST['csvContent'])) {
    $filename = 'results.csv';
    
    // Append to file if it exists, create if it doesn't
    file_put_contents($filename, $_POST['csvContent'], FILE_APPEND | LOCK_EX);
    
    echo 'Results saved successfully';
} else {
    http_response_code(400);
    echo 'Invalid data received';
}