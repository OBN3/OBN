<?php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (isset($data['csvContent'])) {
    $filename = 'results.csv';
    
    // Append to file if it exists, create if it doesn't
    file_put_contents($filename, $data['csvContent'], FILE_APPEND | LOCK_EX);
    
    echo json_encode(['status' => 'success', 'message' => 'Results saved successfully']);
} else {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid data received']);
}