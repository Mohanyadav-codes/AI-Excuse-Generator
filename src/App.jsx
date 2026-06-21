import { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Sparkles, 
  Copy, 
  Check, 
  Share2, 
  Trash2, 
  X, 
  Lightbulb, 
  RefreshCw, 
  AlertCircle,
  Settings,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateExcuse } from './ollama';
import './App.css';

// Quirky, nerdy Baljeet character quotes
const MASCOT_QUOTES = [
  "Oh no! Did you miss a deadline? Let me calculate a highly logical excuse!",
  "My equations show a 98.4% probability that this excuse will work.",
  "According to my mathematical models, this is the perfect excuse!",
  "I should be studying, but resolving your dilemmas is a fascinating logical problem.",
  "Okay, okay, don't panic! Let me compute a foolproof explanation."
];

const CATEGORIES = ['Work', 'Late', 'School', 'Social', 'Family'];
const TONES = ['Believable', 'Dramatic', 'Sci-Fi', 'Savage'];

function App() {
  // --- App State ---
  // Store local Ollama model name. Default to llama3.2
  const [modelName, setModelName] = useState(() => localStorage.getItem('alibi_ollama_model') || 'llama3.2');
  const [problem, setProblem] = useState('');
  const [category, setCategory] = useState('Work');
  const [tone, setTone] = useState('Believable');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { excuse, backup, deliveryTip, refusal }
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('alibi_excuse_history')) || [];
    } catch {
      return [];
    }
  });

  // --- UI State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [tempModel, setTempModel] = useState(modelName);
  const [mascotSpeech, setMascotSpeech] = useState(MASCOT_QUOTES[0]);
  const [copiedPrimary, setCopiedPrimary] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const toastTimer = useRef(null);

  // Sync temp model when modelName updates
  useEffect(() => {
    setTempModel(modelName);
  }, [modelName]);

  // Sync history in localStorage
  useEffect(() => {
    localStorage.setItem('alibi_excuse_history', JSON.stringify(history));
  }, [history]);

  // Helper to show modern toast notification
  const triggerToast = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setShowToast(true);
    toastTimer.current = setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Sound effect / Audio synthesis for UI feedback
  const playUISound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Audio context not allowed or supported by browser");
    }
  };

  // --- Model Settings Handlers ---
  const handleSaveSettings = () => {
    const trimmed = tempModel.trim();
    localStorage.setItem('alibi_ollama_model', trimmed);
    setModelName(trimmed);
    setIsSettingsOpen(false);
    playUISound('success');
    triggerToast(`Model updated to "${trimmed}"!`);
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!problem.trim()) return;

    setLoading(true);
    setResult(null);
    playUISound('click');

    // Update speech bubble to sound busy
    setMascotSpeech(`Calculating excuse on local model "${modelName}"... Please hold!`);

    try {
      const data = await generateExcuse(modelName, problem.trim(), category, tone);
      setLoading(false);

      if (data.refusal) {
        // AI detected out-of-scope query
        setMascotSpeech(data.refusal);
        setResult({ refusal: data.refusal });
        playUISound('error');
      } else {
        // AI returned excuse JSON
        setResult(data);
        setMascotSpeech(MASCOT_QUOTES[Math.floor(Math.random() * MASCOT_QUOTES.length)]);
        playUISound('success');

        // Add to history
        const newHistoryItem = {
          id: Date.now(),
          problem: problem.trim(),
          category,
          tone,
          excuse: data.excuse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // cap at 50

        // Trigger confetti for dramatic tone
        if (tone === 'Dramatic') {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.75 },
            colors: ['#ff7675', '#ffeaa7', '#55efc4']
          });
        }
      }
    } catch (err) {
      setLoading(false);
      
      // Detailed feedback for local connection failure
      setMascotSpeech(`Equation failed! Is Ollama running and did you pull "${modelName}"?`);
      triggerToast("Failed to connect to local Ollama server");
      playUISound('error');
    }
  };

  // Copy to clipboard helpers
  const copyText = (text, type) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        playUISound('click');
        triggerToast("Excuse copied to clipboard!");
        if (type === 'primary') {
          setCopiedPrimary(true);
          setTimeout(() => setCopiedPrimary(false), 2000);
        } else {
          setCopiedBackup(true);
          setTimeout(() => setCopiedBackup(false), 2000);
        }
      })
      .catch(() => {
        triggerToast("Failed to copy text");
      });
  };

  // Web Share API or Tweet fallback
  const shareExcuse = (excuseText) => {
    playUISound('click');
    if (navigator.share) {
      navigator.share({
        title: 'Excuse by Baljeet.ai',
        text: `"${excuseText}" - Computed by Baljeet.ai`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      // Tweet link
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `"${excuseText}" - Computed by Baljeet.ai`
      )}`;
      window.open(url, '_blank');
    }
  };

  const deleteHistoryItem = (id, e) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    playUISound('click');
  };

  const clearAllHistory = () => {
    setHistory([]);
    playUISound('error');
    triggerToast("Excuse archive cleared!");
  };

  return (
    <div className="app-container">
      {/* Navigation / Header */}
      <header className="app-header">
        <a href="/" className="logo-container" onClick={(e) => e.preventDefault()}>
          <span className="logo-text">Baljeet.ai</span>
          <span className="logo-badge">Local Ollama</span>
        </a>
        <div className="header-actions">
          <button className="btn-icon-label" onClick={() => { setIsHistoryOpen(true); playUISound('click'); }}>
            <History size={16} />
            <span>Archives</span>
          </button>
          <button className="btn-icon-label" onClick={() => { setIsSettingsOpen(true); playUISound('click'); }}>
            <Settings size={16} />
            <span>Model Settings</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        
        {/* Left Column: Mascot speech & Input Form */}
        <section className="creator-section">
          
          {/* Mascot Display */}
          <div className="mascot-card">
            <div className="mascot-image-wrapper">
              <img 
                src="/mascot.png" 
                alt="Baljeet Mascot" 
                className="mascot-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=150&auto=format&fit=crop&q=60"; // fallback
                }}
              />
              <span className="mascot-badge"></span>
            </div>
            <div className="speech-bubble">
              <div className="mascot-name">Baljeet</div>
              <div className="mascot-text">"{mascotSpeech}"</div>
            </div>
          </div>

          {/* Form */}
          <form className="form-card" onSubmit={handleGenerate}>
            <div className="form-group">
              <label htmlFor="problem-input" className="form-label">
                <Sparkles className="label-icon" />
                What's the dilemma, class?
              </label>
              <div className="textarea-wrapper">
                <textarea
                  id="problem-input"
                  className="input-problem"
                  placeholder="e.g., I missed my class because my alarm failed, or I didn't finish the essay..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value.slice(0, 300))}
                  maxLength={300}
                />
                <span className="char-counter">{problem.length}/300</span>
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">Excuse Category</span>
              <div className="category-container">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`tag-btn ${category === cat ? 'active' : ''}`}
                    onClick={() => { setCategory(cat); playUISound('click'); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">Alibi Tone</span>
              <div className="tone-selector">
                {TONES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`tone-option ${tone === t ? `active active-${t.toLowerCase()}` : ''}`}
                    onClick={() => { setTone(t); playUISound('click'); }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn-generate"
              disabled={loading || !problem.trim()}
            >
              <Sparkles size={18} />
              <span>Craft Alibi</span>
            </button>
          </form>
        </section>

        {/* Right Column: Excuses Display */}
        <section className="output-section">
          {loading ? (
            /* Loading Zzz State */
            <div className="loader-wrapper">
              <div className="z-loader">
                <span className="z-letter z-1">z</span>
                <span className="z-letter z-2">z</span>
                <span className="z-letter z-3">z</span>
              </div>
              <div className="loading-text">BALJEET IS THINKING...</div>
            </div>
          ) : result ? (
            result.refusal ? (
              /* Refusal View */
              <div className="refusal-box">
                <AlertCircle className="refusal-icon" size={24} />
                <div className="refusal-content">
                  <span className="refusal-title">Logic Error</span>
                  <span className="refusal-text">{result.refusal}</span>
                </div>
              </div>
            ) : (
              /* Excuses Results View */
              <div className="result-card">
                <div className={`result-glow ${tone.toLowerCase()}`}>{tone} Tone</div>
                
                <div className="excuse-badge-row">
                  <span className="result-badge">{tone} Tone</span>
                  <div className="card-actions-top">
                    <button 
                      className={`btn-card-action ${copiedPrimary ? 'active-copied' : ''}`}
                      title="Copy primary excuse"
                      onClick={() => copyText(result.excuse, 'primary')}
                    >
                      {copiedPrimary ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="excuse-text-block">
                  "{result.excuse}"
                </div>

                {result.backup && (
                  <div className="backup-excuse-block">
                    <div className="backup-title-row">
                      <span className="backup-label">Alternative Formula</span>
                      <button 
                        className={`btn-card-action ${copiedBackup ? 'active-copied' : ''}`}
                        title="Copy alternative excuse"
                        onClick={() => copyText(result.backup, 'backup')}
                      >
                        {copiedBackup ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="backup-text">"{result.backup}"</p>
                  </div>
                )}

                {result.deliveryTip && (
                  <div className="tip-block">
                    <Lightbulb className="tip-icon" />
                    <div className="tip-content">
                      <span className="tip-title">Recommended Presentation:</span>
                      <span className="tip-text">{result.deliveryTip}</span>
                    </div>
                  </div>
                )}

                <div className="result-footer-actions">
                  <button className="btn-primary-card" onClick={() => handleGenerate()}>
                    <RefreshCw size={16} />
                    <span>Recalculate</span>
                  </button>
                  <button className="btn-share-card" onClick={() => shareExcuse(result.excuse)}>
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Empty State */
            <div className="empty-result-card">
              <Sparkles className="empty-icon" />
              <h3 className="empty-title">Excuses will display here</h3>
              <p className="empty-subtitle">
                Enter your dilemma on the left, choose a category, and click "Craft Alibi" to run the local equation.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* History Slide Panel Drawer */}
      <div className={`history-drawer ${isHistoryOpen ? 'open' : ''}`}>
        <div className="history-header">
          <h2 className="history-title">
            <History size={20} />
            <span>Excuse Archives</span>
          </h2>
          <button className="btn-close" onClick={() => { setIsHistoryOpen(false); playUISound('click'); }}>
            <X size={20} />
          </button>
        </div>
        
        <div className="history-list">
          {history.length > 0 ? (
            history.map((item) => (
              <div 
                key={item.id} 
                className="history-item"
                onClick={() => {
                  setProblem(item.problem);
                  setCategory(item.category);
                  setTone(item.tone);
                  setResult({ excuse: item.excuse });
                  setIsHistoryOpen(false);
                  playUISound('click');
                  triggerToast("Loaded excuse from archive!");
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="history-item-top">
                  <span className="history-item-tag" style={{
                    borderColor: '#2e2620',
                    background: item.tone === 'Believable' ? '#74b9ff' : item.tone === 'Dramatic' ? '#fd79a8' : item.tone === 'Sci-Fi' ? '#55efc4' : '#ff7675',
                    color: item.tone === 'Sci-Fi' ? '#2e2620' : '#ffffff',
                    textShadow: item.tone === 'Sci-Fi' ? 'none' : '1px 1px 0px #2e2620'
                  }}>
                    {item.category} • {item.tone}
                  </span>
                  <button 
                    className="btn-item-delete"
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    title="Delete item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="history-item-problem">Q: "{item.problem}"</div>
                <div className="history-item-excuse">"{item.excuse}"</div>
              </div>
            ))
          ) : (
            <div className="history-empty">
              <History className="history-empty-icon" />
              <span>Your archive is empty.</span>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <button className="btn-clear-all" onClick={clearAllHistory}>
            <Trash2 size={16} />
            <span>Clear Archive</span>
          </button>
        )}
      </div>

      {/* Model Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Settings size={20} style={{ color: '#ff7675' }} />
                <span>Ollama Model Settings</span>
              </h2>
              <button className="btn-close" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Configure which model Ollama should use. Make sure the model is pulled and running locally on your computer.
              </p>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.9rem' }}>Local Model Name</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. llama3.2, llama3, mistral, gemma2"
                  value={tempModel}
                  onChange={(e) => setTempModel(e.target.value)}
                />
              </div>
              <div className="modal-description" style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '10px', color: '#2e2620' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <Info size={16} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: '0.1rem' }} />
                  <strong>Steps to configure Ollama:</strong>
                </div>
                <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Ensure Ollama is running on your machine (run <code>ollama serve</code>).</li>
                  <li>Download a model in your terminal, e.g.: <code>ollama pull llama3.2</code></li>
                  <li>Type that model's name (e.g. <code>llama3.2</code>) in the field above and save!</li>
                </ol>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn-modal-save" 
                onClick={handleSaveSettings}
                disabled={!tempModel.trim()}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <div className={`toast-notification ${showToast ? 'show' : ''}`}>
        {toastMessage}
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <p>Baljeet.ai © {new Date().getFullYear()} • <span>Made by a nerdy math kid. Powered by Local Ollama.</span></p>
      </footer>
    </div>
  );
}

export default App;
