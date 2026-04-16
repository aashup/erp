<?php

/**
 * Custom router for PHP built-in server.
 *
 * PHP's built-in server returns 403 for files resolved outside the document
 * root via symlinks (e.g. storage/app/public symlinked into public/storage).
 * This router manually reads and streams such files so they are served correctly
 * during local development with `php artisan serve`.
 */

$publicPath = getcwd();

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? ''
);

$filePath = $publicPath . $uri;

if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    $realPath = realpath($filePath);

    if ($realPath && is_file($realPath)) {
        // File is outside doc-root (symlink target) — stream it manually.
        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($realPath) ?: 'application/octet-stream';

        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($realPath));
        header('Cache-Control: public, max-age=86400');
        readfile($realPath);
        return;
    }

    // File is inside doc-root — let PHP serve it natively.
    return false;
}

require_once $publicPath . '/index.php';
