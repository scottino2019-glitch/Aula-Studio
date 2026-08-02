import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, X, Loader2, AlertCircle } from 'lucide-react';

// Configure pdf.js worker using Vite local asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  url?: string;
  fileData?: ArrayBuffer;
  title: string;
  onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, fileData, title, onClose }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        let loadingTask;
        if (fileData) {
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileData) });
        } else if (url) {
          loadingTask = pdfjsLib.getDocument({ url });
        } else {
          throw new Error('Nessun file o URL fornito');
        }

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        if (!isCancelled) {
          setError(
            err.message ||
              'Impossibile caricare il PDF. Verifica che il file esista o prova a ricaricarlo.'
          );
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url, fileData]);

  // Render pages when doc, viewMode or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;

    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const pdf = pdfDocRef.current;

    const renderPages = async () => {
      if (viewMode === 'scroll') {
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });

            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper mb-6 flex flex-col items-center relative';
            pageWrapper.dataset.pageNumber = i.toString();

            const canvas = document.createElement('canvas');
            canvas.className = 'shadow-md rounded border border-gray-200 bg-white max-w-full';
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const pageNumBadge = document.createElement('div');
            pageNumBadge.className = 'text-xs text-gray-500 my-1 font-sans font-medium';
            pageNumBadge.innerText = `Pagina ${i} di ${pdf.numPages}`;

            pageWrapper.appendChild(canvas);
            pageWrapper.appendChild(pageNumBadge);
            container.appendChild(pageWrapper);

            if (context) {
              await page.render({
                canvasContext: context,
                viewport: viewport,
              }).promise;
            }
          } catch (e) {
            console.error(`Error rendering page ${i}:`, e);
          }
        }
      } else {
        // Single page mode
        try {
          const page = await pdf.getPage(currentPage);
          const viewport = page.getViewport({ scale });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page-wrapper flex flex-col items-center';

          const canvas = document.createElement('canvas');
          canvas.className = 'shadow-md rounded border border-gray-200 bg-white max-w-full';
          const context = canvas.getContext('2d');

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;
          }
        } catch (e) {
          console.error(`Error rendering page ${currentPage}:`, e);
        }
      }
    };

    renderPages();
  }, [loading, scale, viewMode, currentPage]);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col font-sans">
      {/* Header Toolbar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 text-white p-1.5 rounded-lg">
            📄
          </div>
          <div>
            <h3 className="font-bold text-base m-0 text-white truncate max-w-[250px] sm:max-w-md">
              {title}
            </h3>
            {numPages > 0 && (
              <span className="text-xs text-slate-400">
                {numPages} Pagine totali
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800 rounded-lg p-1 flex items-center gap-1 border border-slate-700">
            <button
              onClick={() => setViewMode('scroll')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                viewMode === 'scroll'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Tutte le pagine
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                viewMode === 'single'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pagina singola
            </button>
          </div>

          {viewMode === 'single' && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 text-xs">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-1 text-slate-200">
                {currentPage} / {numPages}
              </span>
              <button
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 text-xs">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
              className="p-1 text-slate-300 hover:text-white"
              title="Riduci Zoom"
            >
              <ZoomOut size={16} />
            </button>
            <span className="px-1.5 text-slate-200 font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              className="p-1 text-slate-300 hover:text-white"
              title="Aumenta Zoom"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition ml-2 border border-slate-700"
            title="Chiudi Lettore"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Document Scroll View Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-slate-800/90">
        {loading && (
          <div className="flex flex-col items-center justify-center text-white gap-3 my-auto">
            <Loader2 className="animate-spin text-red-500" size={40} />
            <p className="text-sm font-medium">Caricamento documento in corso...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-500/50 p-6 rounded-2xl max-w-md text-white text-center my-auto">
            <AlertCircle className="mx-auto text-red-400 mb-3" size={40} />
            <h4 className="text-lg font-bold mb-2">Errore di Caricamento</h4>
            <p className="text-xs text-red-200 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition"
            >
              Chiudi
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className={`pdf-canvas-container flex flex-col items-center w-full max-w-4xl ${
            loading || error ? 'hidden' : 'block'
          }`}
        />
      </div>
    </div>
  );
};
