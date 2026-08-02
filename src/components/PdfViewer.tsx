import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Loader2, AlertCircle, ExternalLink, Monitor, BookOpen } from 'lucide-react';

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
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'native' | 'canvas'>('native');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Generate blob URL if fileData is provided
  useEffect(() => {
    if (fileData) {
      const blob = new Blob([fileData], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else if (url) {
      setBlobUrl(url);
    }
  }, [url, fileData]);

  // Load PDF Document for Canvas mode
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
        console.error('Error loading PDF document:', err);
        if (!isCancelled) {
          setError(
            err.message ||
              'Impossibile caricare il PDF nel lettore. Prova a usarne un altro o aprirlo esternamente.'
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

  // Render SINGLE page on Canvas securely without memory leaks
  useEffect(() => {
    if (viewMode !== 'canvas' || !pdfDocRef.current || loading) return;

    let isSubscribed = true;

    const renderSinglePage = async () => {
      try {
        // Cancel any ongoing rendering task before starting a new one
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const pdf = pdfDocRef.current;
        if (!pdf) return;

        const page = await pdf.getPage(currentPage);
        if (!isSubscribed) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Calculate responsive scale based on screen width
        const screenWidth = Math.min(window.innerWidth - 32, 768);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const fitScale = (screenWidth / unscaledViewport.width) * scale;
        const viewport = page.getViewport({ scale: Math.max(0.5, Math.min(fitScale, 2.5)) });

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', e);
        }
      }
    };

    renderSinglePage();

    return () => {
      isSubscribed = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [viewMode, currentPage, scale, loading]);

  const activePdfUrl = blobUrl || url;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col font-sans select-none">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-red-600 text-white p-1.5 rounded-lg text-sm shrink-0">
            📄
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base m-0 text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {title}
            </h3>
            {numPages > 0 && (
              <span className="text-[11px] text-slate-400 block">
                {numPages} {numPages === 1 ? 'pagina' : 'pagine totali'}
              </span>
            )}
          </div>
        </div>

        {/* View mode switcher & controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-700">
            <button
              onClick={() => setViewMode('native')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1 ${
                viewMode === 'native'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Lettore Integrato Leggero"
            >
              <Monitor size={14} />
              <span className="hidden sm:inline">Lettore Integrato</span>
              <span className="sm:hidden">Integrato</span>
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1 ${
                viewMode === 'canvas'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Pagina per Pagina (Canvas)"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Pagina Singola</span>
              <span className="sm:hidden">Pagina</span>
            </button>
          </div>

          {/* Page & Zoom Navigation (only in Canvas mode) */}
          {viewMode === 'canvas' && (
            <>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 text-xs">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30"
                  title="Pagina precedente"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-1 text-slate-200 font-mono font-medium">
                  {currentPage} / {numPages || 1}
                </span>
                <button
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30"
                  title="Pagina successiva"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 text-xs">
                <button
                  onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                  className="p-1 text-slate-300 hover:text-white"
                  title="Zoom -"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="px-1 text-slate-200 font-mono">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(2.0, s + 0.2))}
                  className="p-1 text-slate-300 hover:text-white"
                  title="Zoom +"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </>
          )}

          {activePdfUrl && (
            <a
              href={activePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700"
              title="Apri in nuova scheda"
            >
              <ExternalLink size={16} />
            </a>
          )}

          <button
            onClick={onClose}
            className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition border border-red-500/50 ml-1"
            title="Chiudi"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-2 sm:p-4 flex flex-col items-center justify-center bg-slate-900/90 relative">
        
        {/* MODE 1: NATIVE IFRAME EMBED (Default, Hardware accelerated, ZERO memory crash) */}
        {viewMode === 'native' && (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {activePdfUrl ? (
              <iframe
                src={`${activePdfUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-xl border border-slate-700 bg-white shadow-2xl"
                title={`Lettore PDF - ${title}`}
              />
            ) : (
              <div className="text-white text-center p-6 bg-slate-800 rounded-2xl border border-slate-700">
                <AlertCircle className="mx-auto text-amber-400 mb-2" size={36} />
                <p className="text-sm font-medium">Nessun file PDF disponibile da visualizzare.</p>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: CANVAS SINGLE PAGE (Page per Page, Ultra light) */}
        {viewMode === 'canvas' && (
          <div className="flex flex-col items-center w-full h-full overflow-auto py-2">
            {loading && (
              <div className="flex flex-col items-center justify-center text-white gap-3 my-auto">
                <Loader2 className="animate-spin text-red-500" size={36} />
                <p className="text-xs font-medium">Preparazione pagina...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-950/60 border border-red-600/50 p-6 rounded-2xl max-w-sm text-white text-center my-auto">
                <AlertCircle className="mx-auto text-red-400 mb-2" size={36} />
                <h4 className="text-sm font-bold mb-1">Errore Lettore Canvas</h4>
                <p className="text-xs text-red-200 mb-3">{error}</p>
                <button
                  onClick={() => setViewMode('native')}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Passa al Lettore Integrato
                </button>
              </div>
            )}

            {!loading && !error && (
              <div className="flex flex-col items-center justify-center my-auto">
                <div className="bg-white p-1 rounded-lg shadow-xl border border-slate-700 max-w-full overflow-auto">
                  <canvas ref={canvasRef} className="block max-w-full rounded" />
                </div>

                {/* Bottom Pagination for Canvas */}
                <div className="flex items-center gap-3 mt-3 bg-slate-800/90 backdrop-blur px-4 py-1.5 rounded-full border border-slate-700 text-white text-xs">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 hover:text-red-400 disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-semibold text-slate-200">
                    Pagina {currentPage} di {numPages}
                  </span>
                  <button
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    className="p-1 hover:text-red-400 disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

