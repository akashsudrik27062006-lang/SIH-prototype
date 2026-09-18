import { useState } from 'react';
import { Camera, RefreshCw, Upload } from 'lucide-react';
import { products, SCAN_STEPS } from '../../data/mockData';
import { createMockResult } from '../../services/mock/complianceService';
import { ScanGauge } from '../ui/Widgets';

export default function Scanner({ done, role }) {
  const [product, setProduct] = useState(products[role === 'manufacturer' ? 0 : 1]);
  const [file, setFile] = useState();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const analyze = () => {
    if (!file) return alert('Please upload a product packaging image.');
    setLoading(true); setStep(0);
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index === SCAN_STEPS.length) { clearInterval(timer); done(createMockResult(product)); }
      else setStep(index);
    }, 320);
  };
  const progress = loading ? Math.round(((step + 1) / SCAN_STEPS.length) * 100) : 0;

  return <section className="scanner"><div className="sample-picker"><b>Select Demo Scenario:</b>{products.map((item) => <button key={item.id} onClick={() => setProduct(item)} className={item.id === product.id ? 'active' : ''}>{item.image} {item.name}</button>)}</div><label className="dropzone"><input aria-label="Upload product label" type="file" accept="image/*" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) setFile(URL.createObjectURL(selected)); }} disabled={loading} />{file ? <img src={file} alt="Product label preview" /> : <><Upload size={32} /><b>Upload product label or Principal Display Panel</b><span>Supported formats: JPG, PNG, WEBP (Simulated OCR)</span></>}{loading && <div className="scan-overlay"><ScanGauge progress={progress} /><b>{SCAN_STEPS[step]}</b><span>Evaluating against statutory Legal Metrology rules</span></div>}</label>{file && <div className="scan-actions"><button className="btn outline" onClick={() => setFile(undefined)} disabled={loading}>Remove Image</button><button className="btn primary" onClick={analyze} disabled={loading}>{loading ? <RefreshCw className="spin" size={16} /> : <Camera size={16} />}{loading ? 'Analyzing...' : role === 'consumer' ? 'Check Product' : 'Run Compliance Scan'}</button></div>}</section>;
}
