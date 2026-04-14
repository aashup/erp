import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ocrApi, type OcrScanResponse } from '@/api/ocr';
import { ScanLine, Upload, X, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface OcrUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OcrUploadDialog({ open, onClose }: OcrUploadDialogProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on cleanup / file change to prevent memory leaks
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setIsDragging(false);
    }
  }, [open]);

  const handleFile = useCallback((selected: File) => {
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      return;
    }
    setFile(selected);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selected));
  }, [preview]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    // Reset input value so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleClear = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const scanMutation = useMutation({
    mutationFn: (imageFile: File) => ocrApi.scan(imageFile),
    onSuccess: (res) => {
      const result: OcrScanResponse = res.data;
      onClose();
      navigate('/purchase/invoices/ocr-review', { state: { ocrResult: result } });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'OCR failed. Check your API key in Settings → Base.';
      toast.error(msg);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Scan Purchase Invoice" size="lg">
      <div className="space-y-4">
        {!file ? (
          /* Drop zone */
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
            }`}
          >
            <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Click to browse or drag &amp; drop
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                JPG, PNG, WEBP · Max 10 MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          /* Preview */
          <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <img
              src={preview!}
              alt="Invoice preview"
              className="max-h-64 w-full object-contain bg-gray-50 dark:bg-gray-900"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-2 rounded-full bg-white p-1 shadow hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              <ImageIcon className="h-4 w-4 text-gray-400" />
              <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                {file.name}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {scanMutation.isPending && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Sending to AI… this may take up to a minute for large images.
          </p>
        )}

        <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!file}
            loading={scanMutation.isPending}
            onClick={() => file && scanMutation.mutate(file)}
          >
            <ScanLine className="mr-2 h-4 w-4" />
            Scan Invoice
          </Button>
        </div>
      </div>
    </Modal>
  );
}
