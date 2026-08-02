import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, FileText, X, Globe, Wifi, WifiOff, CheckCircle2, Plus } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  // State for note & progress text areas
  const [noteText, setNoteText] = useState<string>('');
  const [progressText, setProgressText] = useState<string>('');
  const [mood, setMoodState] = useState<number | null>(null);

  // PDF Library State
  const defaultPdfs = [
    { name: 'Atena_Grammatica.pdf', url: '/Atena_Grammatica.pdf' },
    { name: 'chinese-per-i-bambini.pdf', url: '/chinese-per-i-bambini.pdf' },
  ];

  const [pdfList, setPdfList] = useState<Array<{ name: string; url?: string }>>(defaultPdfs);
  const [selectedPdf, setSelectedPdf] = useState<{ name: string; url?: string } | null>(null);
  const [selectedPdfData, setSelectedPdfData] = useState<ArrayBuffer | undefined>(undefined);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // App Link Viewer Modal State
  const [activeAppLink, setActiveAppLink] = useState<{ title: string; url: string } | null>(null);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load initial data from localStorage
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

    // Custom PDF list if saved
    const savedPdfs = localStorage.getItem('custom-pdf-list');
    if (savedPdfs) {
      try {
        const parsed = JSON.parse(savedPdfs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const withUrls = parsed.map((item: { name: string; url?: string }) => ({
            name: item.name,
            url: item.url || `/${item.name}`
          }));
          setPdfList(withUrls);
        }
      } catch (e) {
        console.error('Error loading saved PDFs', e);
      }
    }

    // PWA Install Event Listener
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

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if running as standalone display
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const fileUrl = URL.createObjectURL(file);
      const newItem = { name: file.name, url: fileUrl };
      const updated = [newItem, ...pdfList];
      setPdfList(updated);
      
      // Save metadata with name
      const toSave = updated.map(item => ({ name: item.name }));
      localStorage.setItem('custom-pdf-list', JSON.stringify(toSave));

      // Open uploaded file directly in canvas viewer
      setSelectedPdf(newItem);
      setSelectedPdfData(buffer);
      setIsPdfModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
  };

  // Open PDF Reader
  const openPdfReader = (pdf?: { name: string; url?: string }) => {
    const target = pdf || pdfList[0] || defaultPdfs[0];
    const pdfUrl = target.url || `/${target.name}`;
    setSelectedPdf({ ...target, url: pdfUrl });
    setSelectedPdfData(undefined);
    setIsPdfModalOpen(true);
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
    { title: 'Brutal Lab', icon: '⚡', href: 'brutal-lab.html' },
    { title: 'Esercizi', icon: '📝', href: 'quiz-cinese_app.html' },
    { title: 'Lezioni', icon: '🎥', href: 'hub_lezione.html' },
    { title: 'Vocabolario', icon: '📖', href: 'vocabolario-creator.html' },
    { title: 'Editor', icon: '✍️', href: 'lingueEditor.html' },
    { title: 'Builder', icon: '🛠️', href: 'builder.html' },
    { title: 'Gramm.', icon: '📚', href: 'https://grammar-creator.vercel.app/' },
    { title: 'Mappe', icon: '🗺️', href: 'mappe.html' },
    { title: 'Libro Es.', icon: '🎓', href: 'libro-esercizi.html' },
    { title: 'Cultura', icon: '🌍', href: 'libro-cultura.html' },
    { title: 'Libro Lez.', icon: '📓', href: 'libro-lingue.html' },
    { title: 'FlashCard', icon: '🧧', href: 'flashcard-video.html' },
    { title: 'Gramm2', icon: '📖', href: 'https://scottino2019-glitch.github.io/GrammarForge/' },
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

      {/* PDF Canvas Reader (In-App, No Download) */}
      {isPdfModalOpen && selectedPdf && (
        <PdfViewer
          url={selectedPdf.url}
          fileData={selectedPdfData}
          title={selectedPdf.name}
          onClose={() => {
            setIsPdfModalOpen(false);
            setSelectedPdfData(undefined);
          }}
        />
      )}

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
