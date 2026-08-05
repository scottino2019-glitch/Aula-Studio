import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, FileText, X, Globe, Wifi, WifiOff, CheckCircle2, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// IndexedDB helper for App.tsx
const DB_NAME = 'StudyApp_PDF_DB';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_files';

function openPdfDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function savePdfToDB(id: string, name: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await openPdfDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, name, data: arrayBuffer, date: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

async function getSavedPdfsFromDB(): Promise<Array<{ id: string; name: string }>> {
  try {
    const db = await openPdfDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const res = request.result || [];
        resolve(res.map((item: any) => ({ id: item.id, name: item.name })));
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export default function App() {
  // State for note & progress text areas
  const [noteText, setNoteText] = useState<string>('');
  const [progressText, setProgressText] = useState<string>('');
  const [mood, setMoodState] = useState<number | null>(null);

  // PDF Library State
  const defaultPdfs = [
    { id: 'chinese-per-i-bambini.pdf', name: 'chinese-per-i-bambini.pdf' },
    { id: 'Atena_Grammatica.pdf', name: 'Atena_Grammatica.pdf' },
  ];

  const [pdfList, setPdfList] = useState<Array<{ id: string; name: string }>>(defaultPdfs);

  // App Link Viewer Modal State
  const [activeAppLink, setActiveAppLink] = useState<{ title: string; url: string } | null>(null);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load initial data from localStorage and IndexedDB
  useEffect(() => {
    // Note Area
    const savedNote = localStorage.getItem('note-area');
    if (savedNote !== null) {
      setNoteText(savedNote);
    } else {
      setNoteText('Ricordati di caricare i nuovi appunti entro venerdì! Il gruppo ti aspetta. ✨');
    }

    // Progress Area
    const savedProgress = localStorage.getItem('progress-area');
    if (savedProgress !== null) {
      setProgressText(savedProgress);
    }

    // User Mood
    const savedMood = localStorage.getItem('userMood');
    if (savedMood !== null) {
      const idx = parseInt(savedMood, 10);
      if (!isNaN(idx)) {
        setMoodState(idx);
      }
    }

    // Load custom PDFs from IndexedDB
    getSavedPdfsFromDB().then((customs) => {
      if (customs.length > 0) {
        setPdfList([...defaultPdfs, ...customs]);
      }
    });

    // PWA Install Event Listener & Message Handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleIframeMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CLOSE_MODAL') {
        setActiveAppLink(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('message', handleIframeMessage);

    // Check if running as standalone display
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);

  // Handlers for instant storage updates
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteText(val);
    localStorage.setItem('note-area', val);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setProgressText(val);
    localStorage.setItem('progress-area', val);
  };

  const handleSetMood = (idx: number) => {
    setMoodState(idx);
    localStorage.setItem('userMood', idx.toString());
  };

  // PWA Install trigger
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // Upload Custom PDF
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const fileId = `custom_${Date.now()}_${file.name}`;
      await savePdfToDB(fileId, file.name, buffer);

      const newItem = { id: fileId, name: file.name };
      setPdfList((prev) => [...prev, newItem]);

      // Open lightweight Biblioteca page with this PDF
      setActiveAppLink({ title: 'Biblioteca PDF', url: `biblioteca.html?pdf=${encodeURIComponent(fileId)}` });
    } catch (err) {
      console.error('Error uploading PDF:', err);
      alert('Errore nel salvataggio del file PDF.');
    }
  };

  // Open PDF Reader
  const openPdfReader = (pdf?: { id: string; name: string }) => {
    const targetId = pdf ? pdf.id : 'chinese-per-i-bambini.pdf';
    setActiveAppLink({ title: 'Biblioteca PDF', url: `biblioteca.html?pdf=${encodeURIComponent(targetId)}` });
  };

  // App Link Click Handler
  const handleAppClick = (e: React.MouseEvent, appName: string, href: string) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // External full URL -> let browser navigate normally in new tab
      return;
    }
    // Local HTML file reference -> show embedded modal viewer preview
    e.preventDefault();
    setActiveAppLink({ title: appName, url: href });
  };

  const apps = [
    { title: 'Biblioteca', icon: '📖', href: 'biblioteca.html' },
    { title: 'Brutal Lab', icon: '⚡', href: 'brutal-lab.html' },
    { title: 'Esercizi', icon: '📝', href: 'quiz-cinese_app.html' },
    { title: 'Lezioni', icon: '🎥', href: 'hub_lezione.html' },
    { title: 'Vocabolario', icon: '📚', href: 'vocabolario-creator.html' },
    { title: 'Editor', icon: '✍️', href: 'lingueEditor.html' },
    { title: 'Builder', icon: '🛠️', href: 'builder.html' },
    { title: 'Gramm.', icon: '📘', href: 'https://grammar-creator.vercel.app/' },
    { title: 'Mappe', icon: '🗺️', href: 'mappe.html' },
    { title: 'Libro Es.', icon: '🎓', href: 'libro-esercizi.html' },
    { title: 'Cultura', icon: '🌍', href: 'libro-cultura.html' },
    { title: 'Libro Lez.', icon: '📓', href: 'libro-lingue.html' },
    { title: 'FlashCard', icon: '🧧', href: 'flashcard-video.html' },
    { title: 'Gramm2', icon: '📗', href: 'https://scottino2019-glitch.github.io/GrammarForge/' },
    { title: 'LinguistBook', icon: '🌎', href: 'https://linguistbook.netlify.app/' },
    { title: 'LinguaCraft', icon: '🌏', href: 'https://lesson-creator.netlify.app/' },
  ];

  return (
    <div className="notebook-page">
      {/* PWA Offline & Install Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs opacity-80 border-b border-dashed border-gray-300 pb-2">
        <div className="flex items-center gap-1.5 font-sans">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Wifi size={12} /> PWA Attiva • Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <WifiOff size={12} /> Modalità Offline (App salvata)
            </span>
          )}
        </div>
        
        {isInstallable && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-pink-100 hover:bg-pink-200 text-pink-900 border border-pink-300 px-3 py-1 rounded-full cursor-pointer transition text-xs font-bold"
          >
            <Download size={13} /> Installa PWA App
          </button>
        )}
      </div>

      <header>
        <h1>Study Home</h1>

        {/* PWA Banner if prompt ready */}
        {isInstallable && !isInstalled && (
          <div className="pwa-banner">
            <span>📲 <strong>Installa App Studio!</strong> Aggiungila alla schermata home del tuo telefono o PC per usarla offline.</span>
            <button onClick={handleInstallClick} className="pwa-btn">
              Installa Ora 📥
            </button>
          </div>
        )}

        <div className="apps-grid">
          {apps.map((app, index) => (
            <a
              key={index}
              href={app.href}
              target={app.href.startsWith('http') ? '_blank' : undefined}
              rel={app.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="app-icon"
              onClick={(e) => handleAppClick(e, app.title, app.href)}
            >
              <span>{app.icon}</span>
              {app.title}
            </a>
          ))}
        </div>
      </header>

      <div className="content-grid">
        <div className="left-col">
          <div className="section">
            <div className="flex items-center justify-between pr-2">
              <h2>Libreria PDF 📄</h2>
              <label className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 font-sans">
                <Upload size={12} /> Carica PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
              </label>
            </div>

            <div style={{ fontSize: '0.9em', lineHeight: '1.8' }}>
              {pdfList.map((pdf, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-black/5 cursor-pointer transition"
                  onClick={() => openPdfReader(pdf)}
                >
                  <span className="truncate">📄 {pdf.name}</span>
                  <span className="text-xs text-orange-600 font-bold hover:underline ml-2">Apri</span>
                </div>
              ))}
            </div>

            <button className="pdf-btn" onClick={() => openPdfReader()}>
              📎 Apri Lettore PDF
            </button>
          </div>

          <hr className="my-6 border-t-2 border-dashed border-gray-200" />

          <div className="sticky-note">
            <h3 style={{ margin: '0 0 10px 0', color: '#d81b60' }}>Bacheca Note 📌</h3>
            <textarea
              id="note-area"
              className="edit-box"
              style={{ height: '120px' }}
              placeholder="Scrivi qui i promemoria..."
              value={noteText}
              onChange={handleNoteChange}
            />
          </div>
        </div>

        <div className="right-col">
          <div className="highlight-box">
            <h3 style={{ margin: '0 0 10px 0' }}>Avanzamento Studio 📝</h3>
            <textarea
              id="progress-area"
              className="edit-box"
              style={{ height: '140px' }}
              placeholder="Cosa hai studiato oggi? Cosa devi fare domani?"
              value={progressText}
              onChange={handleProgressChange}
            />
          </div>

          <div className="section" style={{ marginTop: '40px' }}>
            <h2>Mood del Giorno 🧡</h2>
            <div className="mood-selector">
              {['🧡', '🙂', '😐', '😴', '🫤'].map((emoji, idx) => (
                <span
                  key={idx}
                  className={`mood-btn ${mood === idx ? 'active' : ''}`}
                  onClick={() => handleSetMood(idx)}
                  title={`Mood ${idx + 1}`}
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Sub-App Viewer Modal */}
      {activeAppLink && (
        <div className="modal-overlay" onClick={() => setActiveAppLink(null)}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '950px', height: '85vh', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="text-pink-500" size={22} />
                <h3 className="text-xl font-bold m-0">{activeAppLink.title}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-sans">
                  {activeAppLink.url}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeAppLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 px-3 py-1 rounded-lg font-sans font-semibold transition"
                >
                  Apri in Nuova Scheda ↗
                </a>
                <button
                  onClick={() => setActiveAppLink(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
              <iframe
                src={activeAppLink.url}
                className="w-full h-full border-0"
                title={activeAppLink.title}
                onError={() => {
                  console.warn('Iframe load fallback for local app:', activeAppLink.url);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
