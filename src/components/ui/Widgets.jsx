import { CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { URL_NCH } from '../../data/mockData';

export function Seal({ score, statusLabel, tone, size = 96 }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = tone === 'good' ? 'var(--status-good)' : tone === 'warn' ? 'var(--status-warn)' : 'var(--status-bad)';
  const offset = circumference - (score / 100) * circumference;
  return <div className={`seal seal-${tone}`}><div className="seal-ring-wrapper"><svg width={size} height={size} viewBox="0 0 96 96"><circle cx="48" cy="48" r={radius} stroke="var(--border-light)" strokeWidth="6" fill="none" /><circle cx="48" cy="48" r={radius} stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} fill="none" transform="rotate(-90 48 48)" /></svg><div className="seal-center-text"><b>{score}</b><span>/100</span></div></div><div className="seal-badge">{statusLabel.replace(/_/g, ' ')}</div></div>;
}

export function ScanGauge({ progress }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return <svg viewBox="0 0 64 64" width="60" height="60"><circle cx="32" cy="32" r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" /><circle cx="32" cy="32" r={radius} stroke="var(--brand-primary)" strokeWidth="5" strokeLinecap="round" fill="none" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} transform="rotate(-90 32 32)" /><text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-mono)">{progress}%</text></svg>;
}

export function NchCard() {
  return <section className="panel" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', marginTop: '20px' }}><span className="eyebrow" style={{ color: '#0b6675', fontWeight: 800 }}>OFFICIAL GRIEVANCE SUPPORT</span><h3 style={{ fontSize: '18px', margin: '6px 0 10px', color: '#0f172a' }}>National Consumer Helpline</h3><p style={{ margin: '0 0 12px', fontSize: '14px', color: '#475569' }}>Consumers can use the National Consumer Helpline to seek assistance or register a consumer grievance.</p><p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Helpline: <span style={{ color: '#0b6675' }}>1915</span></p><a className="btn outline" href={URL_NCH} target="_blank" rel="noopener noreferrer" style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700, borderColor: '#cbd5e1' }}>Visit National Consumer Helpline <ExternalLink size={13} /></a></section>;
}

export const Brand = () => <><ShieldCheck /> LabelGuard</>;
export const SuccessIcon = () => <CheckCircle2 />;
