'use client';

import { useEffect, useState } from 'react';
import { Download, Check, Monitor, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type Platform = 'mac-safari' | 'ios' | 'android' | 'desktop';

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const syncMode = () => setInstalled(mode.matches || !!(navigator as Navigator & {standalone?: boolean}).standalone);
    syncMode();
    mode.addEventListener('change', syncMode);
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
    setPlatform(ios ? 'ios' : /Android/.test(ua) ? 'android' : /Mac/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua) ? 'mac-safari' : 'desktop');
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setMessage(''); };
    const complete = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'}).catch(() => {
        // Installation can still work without an offline navigation fallback.
      });
    }
    return () => {
      mode.removeEventListener('change', syncMode);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  async function install() {
    if (!prompt) { setOpen(true); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      setPrompt(null);
      if (result.outcome === 'accepted') { setOpen(false); setInstalled(true); }
      else { setMessage('Installation was cancelled. You can install later from your browser menu.'); setOpen(true); }
    } catch {
      setPrompt(null);
      setMessage('Use your browser’s install option below to finish adding Taskline.');
      setOpen(true);
    } finally { setBusy(false); }
  }

  return <>
    <button className="install-app-button" onClick={() => void install()} disabled={busy || installed}>
      {installed ? <Check size={17}/> : <Download size={17}/>}
      {installed ? 'App installed' : busy ? 'Installing…' : 'Install Taskline'}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="install-dialog">
        <DialogHeader>
          <img className="install-app-icon" src="/icons/taskline.svg" alt="" width="64" height="64"/>
          <DialogTitle>Taskline, one click away</DialogTitle>
          <DialogDescription>Add Taskline to your device, then open it from its own app icon.</DialogDescription>
        </DialogHeader>
        <div className="install-benefits"><Monitor size={18}/><span>Own app window · Same tasks and folders</span></div>
        {message && <p className="install-note" role="status">{message}</p>}
        {prompt ? <button className="primary-btn" disabled={busy} onClick={() => void install()}><Download size={18}/>{busy ? 'Installing…' : 'Install app'}</button> :
          <div className="install-instructions">
            {platform === 'mac-safari' ? <><h3>Install on your Mac</h3><ol><li>In Safari’s menu bar, choose <strong>File → Add to Dock</strong>.</li><li>Keep the name <strong>Taskline</strong> and click <strong>Add</strong>.</li></ol><p>Requires macOS Sonoma or later. Safari handles installation from its menu.</p></> :
            platform === 'ios' ? <><h3><Smartphone size={17}/> Install on iPhone or iPad</h3><ol><li>Open Taskline in Safari and tap <strong>Share</strong>.</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. Keep <strong>Open as Web App</strong> enabled if shown.</li></ol></> :
            platform === 'android' ? <><h3>Install on Android</h3><ol><li>Open Taskline in Chrome.</li><li>Open the <strong>⋮ menu</strong> and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm <strong>Install</strong>.</li></ol></> :
            <><h3>Install on your computer</h3><ol><li>Open Taskline in Chrome or Microsoft Edge.</li><li>Use the <strong>Install</strong> icon in the address bar, or the browser menu’s <strong>Install app</strong> option.</li><li>Confirm installation.</li></ol><p>Already installed? Launch Taskline from your applications. On Mac with Safari, choose <strong>File → Add to Dock</strong>.</p></>}
          </div>}
        <p className="install-note">Your tasks stay in your private workspace. An internet connection is required to view and save them.</p>
      </DialogContent>
    </Dialog>
  </>;
}
