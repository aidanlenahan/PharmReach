import { href } from './base';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, Maximize2, Minimize2, X, Loader2, MessageCircleQuestion, Pill, RotateCcw, Send } from 'lucide-react';
import './medication-helper.css';

import { answer, warmUp, type ChatReply, type ChatSuggestion } from './symptomMatcher';

// Static build: replies come from the keyword matcher in symptomMatcher.ts, not from Gemini.
type Turn = { id: number; question: string; reply?: ChatReply; failed?: string };

const STORAGE_KEY = 'pharmreach:helper:v1';
function restoreChat(): { open?: boolean; expanded?: boolean; draft?: string; turns?: Turn[] } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    return {
      open: saved.open === true, expanded: saved.expanded === true,
      draft: typeof saved.draft === 'string' ? saved.draft.slice(0, 300) : '',
      turns: Array.isArray(saved.turns) ? saved.turns.slice(-5).filter((turn: Turn) => typeof turn.id === 'number' && typeof turn.question === 'string').map((turn: Turn) => ({ ...turn, failed: !turn.reply && !turn.failed ? 'Your request was interrupted by navigation. Please ask again.' : turn.failed })) : [],
    };
  } catch { return {}; }
}
const MAX_CHARS = 300;
const examples = ['Headache', 'Allergies', 'Heartburn', "Can't sleep"];

async function askHelper(message: string, signal: AbortSignal): Promise<ChatReply> {
  const reply = await answer(message);
  if (signal.aborted) throw new Error('Request canceled.');
  return reply;
}

function safeResultsUrl(suggestion: ChatSuggestion) {
  // Only follow same-site results links; rebuild from the ID if anything looks off.
  return href(suggestion.results_url.startsWith('/results?') ? suggestion.results_url : `/results?medication=${encodeURIComponent(suggestion.id)}`);
}

function safeProductUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /(^|\.)(cvs|walgreens)\.com$/.test(parsed.hostname) ? parsed.href : null;
  } catch { return null; }
}

function retailerName(url: string) {
  return new URL(url).hostname.includes('walgreens') ? 'Walgreens' : 'CVS';
}

function Reply({ reply }: { reply: ChatReply }) {
  const urgent = reply.status === 'emergency';
  const [lead, ...rest] = reply.message.split('\n');
  return <div className={`helper-reply${urgent ? ' urgent' : ''}${reply.status === 'pharmacist' ? ' pharmacist' : ''}`} role={urgent ? 'alert' : undefined}>
    {urgent && <AlertTriangle size={18} aria-hidden="true" className="helper-reply-icon" />}
    <div>
      <p>{lead}</p>
      {reply.suggestions.length > 0 && <ul className="helper-suggestions">
        {reply.suggestions.map((suggestion) => {
          const productUrl = safeProductUrl(suggestion.product_url);
          return <li key={suggestion.id}>
            <a className="helper-suggestion" href={safeResultsUrl(suggestion)}>
              <span className="helper-suggestion-icon" aria-hidden="true"><Pill size={17} /></span>
              <span className="helper-suggestion-text"><b>{suggestion.name}</b><small>{suggestion.strength}</small></span>
              <span className="helper-suggestion-cta">Compare stores <ArrowRight size={14} aria-hidden="true" /></span>
            </a>
            {productUrl && <a className="helper-retailer" href={productUrl} target="_blank" rel="noopener noreferrer">View on {retailerName(productUrl)}.com <ArrowUpRight size={12} aria-hidden="true" /></a>}
          </li>;
        })}
      </ul>}
      {rest.map((line, index) => <p key={index} className="helper-reply-note">{line}</p>)}
    </div>
  </div>;
}

export function MedicationHelper() {
  const [saved] = useState(restoreChat);
  const [open, setOpen] = useState(saved.open || false);
  const [expanded, setExpanded] = useState(saved.expanded || false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [draft, setDraft] = useState(saved.draft || '');
  const [turns, setTurns] = useState<Turn[]>(saved.turns || []);
  const [pending, setPending] = useState(false);
  const requestVersion = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const nextId = useRef(Math.max(0, ...(saved.turns || []).map((turn) => turn.id)) + 1);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open, expanded, draft, turns })); } catch { /* Storage may be disabled. */ }
  }, [open, expanded, draft, turns]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.close();
    if (open) {
      if (expanded) dialog.showModal(); else dialog.show();
      inputRef.current?.focus({ preventScroll: true });
    } else if (wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = open;
    if (!open || !expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, expanded]);

  useEffect(() => {
    if (!open || expanded) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, expanded]);

  useEffect(() => {
    if (!open || available !== null) return;
    let active = true;
    // The keyword matcher runs in the browser, so it is always available. Warm it up while the user types.
    Promise.resolve().then(() => { if (active) setAvailable(true); });
    warmUp().catch(() => { /* answer() retries the word list. */ });
    return () => { active = false; };
  }, [open, available]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [turns, pending]);

  useEffect(() => {
    const clear = () => { restartChat(); setOpen(false); setExpanded(false); };
    window.addEventListener('pharmreach:clear-chat', clear);
    return () => window.removeEventListener('pharmreach:clear-chat', clear);
  }, []);

  function restartChat() {
    requestVersion.current++;
    requestAbort.current?.abort();
    requestAbort.current = null;
    setTurns([]);
    setDraft('');
    setPending(false);
    setAvailable(null);
    inputRef.current?.focus({ preventScroll: true });
  }

  async function send(text: string) {
    const message = text.trim().slice(0, MAX_CHARS);
    if (!message || pending) return;
    const id = nextId.current++;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    requestAbort.current = controller;
    setTurns((current) => [...current.slice(-4), { id, question: message }]);
    setDraft('');
    setPending(true);
    try {
      const reply = await askHelper(message, controller.signal);
      if (version !== requestVersion.current) return;
      if (reply.status === 'unavailable') setAvailable(false);
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, reply } : turn));
    } catch (error) {
      if (version !== requestVersion.current) return;
      const failed = error instanceof TypeError ? 'Couldn’t reach PharmReach. Check your connection and try again.' : error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, failed } : turn));
    } finally {
      if (version === requestVersion.current) {
        requestAbort.current = null;
        setPending(false);
        if (dialogRef.current?.open) inputRef.current?.focus({ preventScroll: true });
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  return <>
    <button ref={launcherRef} className="helper-launcher" aria-label={open ? 'Close medication helper' : 'Open medication helper'} aria-expanded={open} aria-controls="medication-helper" onClick={() => setOpen(!open)}>
      {open ? <X size={22} /> : <MessageCircleQuestion size={22} />}
    </button>
    <dialog ref={dialogRef} id="medication-helper" className={`helper-window${expanded ? ' expanded' : ''}`} aria-labelledby="helper-title" onCancel={(event) => { event.preventDefault(); setOpen(false); }}>
      <header className="helper-header">
        <div><strong id="helper-title">Medication helper</strong><small>Keyword matcher · not AI</small></div>
        <button type="button" onClick={restartChat} aria-label="Restart chat" title="Restart chat"><RotateCcw size={18} /></button>
        <button type="button" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Return to small popup' : 'Expand medication helper'}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close medication helper"><X size={20} /></button>
      </header>
    <section className="helper-panel" aria-label="Medication conversation">
      <div id="helper-privacy-notice" className="helper-privacy-popup" popover="auto" aria-labelledby="helper-privacy-title">
        <header><strong id="helper-privacy-title">Before you chat</strong><button type="button" popoverTarget="helper-privacy-notice" popoverTargetAction="hide" aria-label="Close privacy notice"><X size={18} /></button></header>
        <p><b>This helper is not AI.</b> It is a simple algorithm that looks for symptom words in your message, like “headache” or “heartburn”, and points to matching products from our catalog. It does not understand context, negation (“no fever”), or your health history.</p>
        <p>Your message never leaves your browser. It is matched on this page and is not sent to PharmReach or any other service. Still, avoid sharing personal information; this is not a medical consultation.</p>
        <p>Recent chat messages are saved in this browser tab. You can clear them from the privacy page.</p>
        <a href={href('/privacy')}>Read the full privacy policy →</a>
      </div>
      {available === false ? <p className="helper-state" role="status">The medication helper is not available right now. You can still search by product name on the website.</p> : <>
        <div className="helper-thread" ref={threadRef} aria-live="polite" aria-busy={pending}>
          <div className="helper-turn helper-welcome"><div className="helper-reply"><div><p>Tell me a common symptom, like a headache or heartburn. I'll suggest over-the-counter products tracked nearby.</p><p className="helper-reply-note"><b>Not AI:</b> this helper matches keywords with a fixed set of rules, so it can miss context. Do not share any personal information. See <button type="button" className="helper-disclaimer-link" popoverTarget="helper-privacy-notice">Privacy Notice</button></p></div></div></div>
          {turns.map((turn) => <div key={turn.id} className="helper-turn">
            <p className="helper-question">{turn.question}</p>
            {turn.reply ? <Reply reply={turn.reply} /> : turn.failed ? <p className="helper-state error" role="alert">{turn.failed}</p> : <p className="helper-state loading"><Loader2 size={15} aria-hidden="true" />Finding matching products…</p>}
          </div>)}
        </div>
        <form className="helper-form" onSubmit={submit}>
          <label htmlFor="helper-message" className="helper-label">Describe your symptom</label>
          <div className="helper-input">
            <textarea
              id="helper-message"
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_CHARS}
              placeholder="e.g. I have a stuffy nose and a sore throat"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft); } }}
            />
            <button className="primary" type="submit" disabled={pending || !draft.trim()} aria-label="Ask the medication helper">{pending ? <Loader2 size={16} className="helper-spin" /> : <Send size={16} />}<span>Ask</span></button>
          </div>
          <div className="helper-form-meta">
            <div className="popular"><span>Try:</span>{examples.map((example) => <button type="button" key={example} disabled={pending} onClick={() => void send(example)}>{example}</button>)}</div>
            <small aria-live="polite">{draft.length > MAX_CHARS - 50 ? `${MAX_CHARS - draft.length} characters left` : ''}</small>
          </div>
        </form>
      </>}
      <p className="helper-disclaimer"><b>Not medical advice.</b> <a className="helper-disclaimer-link" href={href('/disclaimer')}>Disclaimer</a><span className="helper-emergency">If emergency, call 911.</span><span className="helper-liability">PharmReach is not responsible for medical emergencies; rely on emergency services.</span></p>
    </section>
    </dialog>
  </>;
}
