import { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Upload, FileText, LogOut, Search, 
  Camera, LayoutDashboard, History as HistoryIcon, ClipboardCheck, Flag, RefreshCw, 
  Printer, MapPin, ExternalLink, ArrowRight, Sparkles, BookOpen, Check, 
  MessageSquare, ArrowLeftRight, ShieldAlert, PhoneCall, AlertCircle
} from 'lucide-react';
import './styles.css';
import { isSupabaseConfigured } from './services/supabase/client';
import { analyzePackageImage } from './services/scan/scanService';
import { createLiveResult } from './services/compliance/ruleEngine';
import { compareSellerListingToPackage } from './services/compliance/sellerListingComparison';
import { CORE_RULES } from './services/compliance/ruleRepository';
import { getPrototypeComplaints, getPrototypeInspections, savePrototypeComplaint, savePrototypeInspection, updatePrototypeInspection } from './services/inspection/prototypeInspectionStore';
import { compareManufacturerComplianceChecks, deleteManufacturerProduct, getManufacturerChecks, getManufacturerProducts, migrateLegacyManufacturerImages, saveManufacturerComplianceCheck } from './services/inspection/prototypeManufacturerStore';
import { deleteImage, getImage, saveImage } from './services/inspection/manufacturerImageStore';
import { getSellerAudits, getSellerComparisons, saveSellerAudit, saveSellerComparison } from './services/inspection/prototypeSellerStore';
import { getSellerImage, saveSellerImage } from './services/inspection/sellerImageStore';

const URL_ACT_2009 = 'https://consumeraffairs.gov.in/pages/legal-metrology-act';
const URL_PCR_2011 = 'https://indiankanoon.org/doc/100694501/';
const URL_AMEND_2023 = 'https://www.legitquest.com/act/legal-metrology-packaged-commodities-amendment-rules-2023/E049';
const URL_NCH = 'https://consumerhelpline.gov.in/';

const products = [
  { 
    id: 'rice', 
    name: 'Premium Basmati Rice', 
    manufacturer: 'ABC Foods Pvt. Ltd.', 
    category: 'Food grain', 
    image: '🍚', 
    status: 'COMPLIANT',
    fields: { 
      'Generic Name': 'Premium Basmati Rice', 
      'Net Quantity': '5 kg', 
      'MRP': '₹650 (incl. of all taxes)', 
      'Manufacturer': 'ABC Foods Pvt. Ltd., Pune 411001', 
      'Country of Origin': 'India', 
      'Consumer Care': '1800-123-4567, care@abcfoods.com', 
      'Packing Date': '07/2026' 
    },
    location: 'Retail Store, Pune, Maharashtra',
    confidence: { 'Generic Name': 99, 'Net Quantity': 98, 'MRP': 97, 'Manufacturer': 96, 'Country of Origin': 95, 'Consumer Care': 93, 'Packing Date': 97 } 
  },
  { 
    id: 'oil', 
    name: 'PureDrop Cooking Oil', 
    manufacturer: 'Narmada Essentials', 
    category: 'Edible oil', 
    image: '🫗', 
    status: 'NON_COMPLIANT',
    fields: { 
      'Generic Name': 'PureDrop Cooking Oil', 
      'Net Quantity': '1 Litre (900 mL)', 
      'MRP': '₹340 (incl. of taxes)', 
      'Manufacturer': 'Narmada Essentials, Indore, MP', 
      'Country of Origin': 'India', 
      'Consumer Care': '1800-780-1212', 
      'Packing Date': '07/2026' 
    },
    location: 'Grocery World, Indore',
    confidence: { 'Generic Name': 96, 'Net Quantity': 62, 'MRP': 95, 'Manufacturer': 93, 'Country of Origin': 94, 'Consumer Care': 90, 'Packing Date': 93 } 
  },
  { 
    id: 'biscuits', 
    name: 'Golden Crunch Biscuits', 
    manufacturer: 'Sunrise Foods India', 
    category: 'Packaged food', 
    image: '🍪', 
    status: 'NON_COMPLIANT',
    fields: { 
      'Generic Name': 'Golden Crunch Biscuits', 
      'Net Quantity': '300 g', 
      'MRP': 'Not detected', 
      'Manufacturer': 'Sunrise Foods India, Noida, UP', 
      'Country of Origin': 'India', 
      'Consumer Care': '1800-222-9090', 
      'Packing Date': '06/2026' 
    },
    location: 'Super Mart, Sector 18, Noida',
    confidence: { 'Generic Name': 97, 'Net Quantity': 95, 'Manufacturer': 92, 'Consumer Care': 94, 'Packing Date': 91 } 
  },
  { 
    id: 'spices', 
    name: 'Heritage Turmeric Powder', 
    manufacturer: 'Not detected', 
    category: 'Spices', 
    image: '🫙', 
    status: 'NON_COMPLIANT',
    fields: { 
      'Generic Name': 'Heritage Turmeric Powder', 
      'Net Quantity': '200 g', 
      'MRP': '₹95', 
      'Manufacturer': 'Not detected', 
      'Country of Origin': 'India', 
      'Consumer Care': 'Not detected', 
      'Packing Date': '08/2026' 
    },
    location: 'Local Kirana Store, Chandni Chowk, Delhi',
    confidence: { 'Generic Name': 94, 'Net Quantity': 92, 'MRP': 90, 'Country of Origin': 88, 'Packing Date': 85 } 
  },
];

const mockViolations = (p) => {
  if (p.id === 'oil') {
    return [
      {
        requirement: 'Net Quantity Specification',
        section: 'Rule 6(1)(b)',
        status: 'MALFORMED',
        detectedValue: '1 Litre (900 mL)',
        expectedValue: '1 L or 1000 mL (Consistent SI unit)',
        explanation: 'Contradictory volume declared: 1 Litre mathematically equals 1000 mL, not 900 mL. This misleads the buyer on true packaged content.',
        ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(b)', url: URL_PCR_2011 },
        recommendation: 'Declare uniform standard metric units without conflicting parenthetical weights.'
      }
    ];
  }
  if (p.id === 'biscuits') {
    return [
      {
        requirement: 'Maximum Retail Price (MRP)',
        section: 'Rule 6(1)(e)',
        status: 'MISSING',
        detectedValue: 'Not detected on display panel',
        expectedValue: 'MRP Rs. / ₹ ... (inclusive of all taxes)',
        explanation: 'The package lacks any visible or unambiguous Maximum Retail Price declaration on the principal display panel.',
        ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(e)', url: URL_PCR_2011 },
        recommendation: 'Print clear, unambiguous MRP inclusive of all applicable taxes.'
      }
    ];
  }
  if (p.id === 'spices') {
    return [
      {
        requirement: 'Manufacturer / Packer Identification',
        section: 'Rule 6(1)(a)',
        status: 'MISSING',
        detectedValue: 'Not detected',
        expectedValue: 'Full corporate name and registered address of Manufacturer/Packer',
        explanation: 'No registered packer or manufacturing address was found printed on the product packaging.',
        ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(a)', url: URL_PCR_2011 },
        recommendation: 'Add the complete manufacturing or packing enterprise name and postal pin code.'
      },
      {
        requirement: 'Consumer Grievance Redressal Mechanism',
        section: 'Rule 6(2)',
        status: 'MISSING',
        detectedValue: 'Not detected',
        expectedValue: 'Designated helpline phone number, email ID, and postal address',
        explanation: 'Missing mandatory consumer care helpline credentials for grievance redressal.',
        ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(2)', url: URL_PCR_2011 },
        recommendation: 'Include active customer care phone and email contact details.'
      }
    ];
  }
  return [];
};

const makeMockResult = (p) => ({
  id: 'INSP-' + Math.floor(1000 + Math.random() * 9000),
  product: p,
  score: p.status === 'COMPLIANT' ? 98 : p.id === 'oil' ? 74 : p.id === 'biscuits' ? 62 : 48,
  status: p.status,
  violations: mockViolations(p),
  date: new Date().toLocaleDateString('en-IN')
});

const labels = { 
  officer: 'Legal Metrology Officer', 
  manufacturer: 'Manufacturer / Packer', 
  seller: 'E-commerce / Seller', 
  consumer: 'Consumer' 
};

const creds = {
  officer: { email: 'officer@labelguard.demo', password: 'officer123', name: 'Ananya Sharma (Insp. ID: LMO-441)' },
  manufacturer: { email: 'manufacturer@labelguard.demo', password: 'manufacturer123', name: 'ABC Foods Quality Desk' },
  seller: { email: 'seller@labelguard.demo', password: 'seller123', name: 'Marketplace Seller Desk' },
  consumer: { email: 'consumer@labelguard.demo', password: 'consumer123', name: 'Rahul Verma' },
};

const ruleSummaries = [
  { 
    id: 'act-2009',
    title: 'Legal Metrology Act, 2009', 
    subtitle: 'Primary Central Act',
    url: URL_ACT_2009,
    source: 'Ministry of Consumer Affairs',
    simpleTakeaway: 'The parent legislation in India establishing legal standards for weights, measures, numerical units, and consumer trade protections.',
    keyPoints: [
      'Standard Metric Units: All pre-packaged goods must declare contents strictly in standard SI metric units (kg, g, L, ml, m).',
      'Statutory Protection: Selling, manufacturing, or distributing packages without mandatory declarations is an offence under Section 18.',
      'Enforcement Powers: Empowers Legal Metrology Officers to inspect premises, audit stock, and seize non-compliant goods under Section 15.',
      'Penal Consequences: Prescribes fines up to ₹25,000 for the first offence, ₹50,000 for the second, and imprisonment for subsequent offences under Section 36.'
    ]
  },
  { 
    id: 'pcr-2011',
    title: 'Packaged Commodities Rules (PCR), 2011', 
    subtitle: 'Mandatory PDP Declarations',
    url: URL_PCR_2011,
    source: 'Indian Kanoon Statutory Library',
    simpleTakeaway: 'Specifies the mandatory declaration fields that must appear clearly on the Principal Display Panel (PDP) of all packaged products.',
    keyPoints: [
      '1. Manufacturer / Packer Details: Registered legal name and complete postal address of the manufacturer, packer, or importer.',
      '2. Generic Name: Unambiguous common or trade name of the product inside.',
      '3. Net Quantity: Stated accurately with valid metric units and symbols (e.g., 500 g, 2 L).',
      '4. Packing Date: Month and year of packing, manufacturing, or import.',
      '5. Maximum Retail Price: Stated as "MRP ₹ / Rs. ... (inclusive of all taxes)".',
      '6. Consumer Care Helpline: Mandatory telephone number, email, and postal address for grievance redressal.',
      '7. Country of Origin: Clear declaration of the country where the product was manufactured.'
    ]
  },
  { 
    id: 'amend-2023',
    title: 'Packaged Commodities (Amendment) Rules, 2023', 
    subtitle: 'Unit Pricing & Digital Marketplace Rules',
    url: URL_AMEND_2023,
    source: 'LegitQuest Legal Portal',
    simpleTakeaway: 'Standardizes Unit Sale Price (USP) declarations and enforces mandatory label transparency across online marketplaces.',
    keyPoints: [
      'Unit Sale Price (USP): Mandatory declaration per gram or milliliter for packages exceeding 1 kg or 1 L to enable transparent pricing.',
      'E-commerce Transparency: Marketplaces (Amazon, Flipkart, Blinkit, etc.) must show all mandatory declarations on digital product pages.',
      'Contrast & Typography: Strict minimum font height and high-contrast color visibility standards for readable packaging.'
    ]
  }
];

const cls = (s) => (s === 'COMPLIANT' || s === 'NO_OBVIOUS_ISSUE_DETECTED' ? 'good' : s === 'WARNING' || s === 'UNDER_REINSPECTION' || s === 'REVIEW_REQUIRED' || s === 'DRAFT' ? 'warn' : 'bad');

function Seal({ score, statusLabel, tone, size = 96 }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const strokeColor = tone === 'good' ? 'var(--status-good)' : tone === 'warn' ? 'var(--status-warn)' : 'var(--status-bad)';
  const offset = c - (score / 100) * c;

  return (
    <div className={`seal seal-${tone}`}>
      <div className="seal-ring-wrapper">
        <svg width={size} height={size} viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} stroke="var(--border-light)" strokeWidth="6" fill="none" />
          <circle
            cx="48"
            cy="48"
            r={r}
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            fill="none"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="seal-center-text">
          <b>{score}</b>
          <span>/100</span>
        </div>
      </div>
      <div className="seal-badge">{statusLabel.replace(/_/g, ' ')}</div>
    </div>
  );
}

function ScanGauge({ progress }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, progress)) / 100) * c;
  return (
    <svg viewBox="0 0 64 64" width="60" height="60">
      <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" />
      <circle
        cx="32"
        cy="32"
        r={r}
        stroke="var(--brand-primary)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        style={{ strokeDasharray: c, strokeDashoffset: offset }}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-mono)">
        {progress}%
      </text>
    </svg>
  );
}

function NchCard() {
  return (
    <section className="panel" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', marginTop: '20px' }}>
      <span className="eyebrow" style={{ color: '#0b6675', fontWeight: 800 }}>OFFICIAL GRIEVANCE SUPPORT</span>
      <h3 style={{ fontSize: '18px', margin: '6px 0 10px', color: '#0f172a' }}>National Consumer Helpline</h3>
      <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#475569' }}>
        Consumers can use the National Consumer Helpline to seek assistance or register a consumer grievance.
      </p>
      <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
        Helpline: <span style={{ color: '#0b6675' }}>1915</span>
      </p>
      <a 
        className="btn outline" 
        href={URL_NCH} 
        target="_blank" 
        rel="noopener noreferrer" 
        style={{ background: '#ffffff', color: '#0f172a', fontWeight: 700, borderColor: '#cbd5e1' }}
      >
        Visit National Consumer Helpline <ExternalLink size={13} />
      </a>
    </section>
  );
}

const SCAN_STEPS = [
  'Reading package display panel...', 
  'Extracting mandatory declarations (OCR)...', 
  'Checking Maximum Retail Price (Rule 6(1)(e))...', 
  'Validating Net Quantity & SI Units (Rule 6(1)(b))...', 
  'Verifying Manufacturer / Packer details (Rule 6(1)(a))...', 
  'Checking Consumer Care helpline credentials (Rule 6(2))...', 
  'Applying Legal Metrology (PCR) 2011 compliance rules...', 
  'Generating compliance assessment...'
];

function Scanner({ done, role, manufacturerProduct = null }) {
  const [product, setProduct] = useState(products[role === 'manufacturer' ? 0 : role === 'seller' ? 1 : 1]);
  const [images, setImages] = useState({});
  const [details, setDetails] = useState({ inspectionType: 'Routine Inspection', productName: '', brandName: '', responsibleParty: '', batchNumber: '', location: '', remarks: '' });
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const imageSlots = [
    ['principal', 'Principal Display Panel'],
    ['back', 'Back Panel'],
    ['side', 'Side / Other Panel'],
    ['evidence', 'Additional Evidence'],
  ];
  const selectedFile = images.principal?.file || Object.values(images).find((item) => item.file)?.file;
  const hasPackageImage = Boolean(selectedFile);

  const imageReferences = () => Object.entries(images).map(([type, image]) => ({ type, imageId: image.imageId, filename: image.filename, contentType: image.contentType }));

  const addImage = async (slot, selected) => {
    if (!selected) return;
    try {
      const stored = role === 'manufacturer' ? await saveImage(selected, { panel: slot }) : null;
      setImages((current) => {
        if (current[slot]?.preview) URL.revokeObjectURL(current[slot].preview);
        if (role === 'manufacturer' && current[slot]?.imageId) deleteImage(current[slot].imageId).catch(() => {});
        return { ...current, [slot]: { file: selected, preview: URL.createObjectURL(selected), imageId: stored?.id, filename: stored?.filename || selected.name, contentType: stored?.contentType || selected.type } };
      });
    } catch (error) {
      alert(`Artwork image could not be saved locally: ${error.message}`);
    }
  };

  const removeImage = (slot) => {
    setImages((current) => {
      if (current[slot]?.preview) URL.revokeObjectURL(current[slot].preview);
      if (role === 'manufacturer' && current[slot]?.imageId) deleteImage(current[slot].imageId).catch(() => {});
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const analyzeDemo = () => {
    if (!hasPackageImage) return alert('Please upload a product packaging image.');
    setLoading(true); 
    setStep(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i === SCAN_STEPS.length) { 
        clearInterval(t); 
        done(makeMockResult(product)); 
      } else {
        setStep(i);
      }
    }, 320);
  };

  const analyzeLive = async () => {
    if (!selectedFile) return alert('Please upload a Principal Display Panel or another package image.');
    setLoading(true); setStep(0);
    try {
      setStep(1);
      const analysis = await analyzePackageImage(selectedFile);
      setStep(6);
      const result = createLiveResult(analysis);
      result.analysis = analysis;
      // Preserve the actual submitted artwork with this independent scan so later
      // version comparison never substitutes a placeholder or overwrites V1.
      result.pendingImages = imageReferences();
      if (details.location.trim()) result.product.location = details.location.trim();
      if (manufacturerProduct) {
        result.product = {
          ...result.product,
          name: manufacturerProduct.name || result.product.name,
          manufacturer: manufacturerProduct.responsibleParty || result.product.manufacturer,
          category: manufacturerProduct.category || result.product.category,
        };
        result.manufacturerProductId = manufacturerProduct.id;
      }
      done({ ...result, inspectionDetails: details });
    } catch (error) {
      alert(`Live analysis could not be completed: ${error.message}`);
      setLoading(false);
    }
  };

  const progress = loading ? Math.round(((step + 1) / SCAN_STEPS.length) * 100) : 0;

  return (
    <section className="scanner">
      {role === 'officer' ? <section className="inspection-details">
        <h2>Inspection Details</h2>
        <div className="inspection-fields">
          <label>Inspection Type<select value={details.inspectionType} onChange={(event) => setDetails({ ...details, inspectionType: event.target.value })} disabled={loading}><option>Routine Inspection</option><option>Complaint-Based Inspection</option><option>Market Surveillance</option><option>Follow-up Inspection</option></select></label>
          <label>Product Name <input value={details.productName} onChange={(event) => setDetails({ ...details, productName: event.target.value })} disabled={loading} /></label>
          <label>Brand Name <input value={details.brandName} onChange={(event) => setDetails({ ...details, brandName: event.target.value })} disabled={loading} /></label>
          <label>Manufacturer / Packer / Importer <input value={details.responsibleParty} onChange={(event) => setDetails({ ...details, responsibleParty: event.target.value })} disabled={loading} /></label>
          <label>Batch / Lot Number <input value={details.batchNumber} onChange={(event) => setDetails({ ...details, batchNumber: event.target.value })} disabled={loading} /></label>
          <label>Inspection Location <input value={details.location} onChange={(event) => setDetails({ ...details, location: event.target.value })} disabled={loading} /></label>
          <label className="inspection-remarks">Officer Remarks <textarea value={details.remarks} onChange={(event) => setDetails({ ...details, remarks: event.target.value })} disabled={loading} /></label>
        </div>
      </section> : null}

      <section className="package-images">
        <h2>Package Images</h2>
        <p>JPG, PNG, WEBP • AI-powered package analysis</p>
        <div className="package-image-grid">
          {imageSlots.map(([slot, label]) => <label key={slot} className="package-image-slot">
            <input aria-label={`Upload ${label}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => addImage(slot, event.target.files?.[0])} disabled={loading} />
            {images[slot]?.preview ? <><img src={images[slot].preview} alt={`${label} preview`} /><button type="button" className="linkbtn" onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeImage(slot); }} disabled={loading}>Remove</button></> : <><Upload size={24} /><b>{label}</b><span>Upload image</span></>}
          </label>)}
        </div>
      </section>

      {loading && <div className="scan-overlay">
        <ScanGauge progress={progress} />
        <b>{SCAN_STEPS[step]}</b>
        <span>Evaluating against statutory Legal Metrology rules</span>
      </div>}

      <div className="scan-actions">
        {role !== 'manufacturer' ? <button className="linkbtn" onClick={() => setDemoMode(!demoMode)} disabled={loading}>{demoMode ? 'Hide Demo Mode' : 'Use Demo Data'}</button> : null}
        {(role === 'officer' || role === 'manufacturer') && isSupabaseConfigured ? <button className="btn primary" onClick={analyzeLive} disabled={loading || !hasPackageImage}>
          {loading ? <RefreshCw className="spin" size={16} /> : <Camera size={16} />}
          {loading ? 'Analyzing...' : 'Run Live AI Scan'}
        </button> : null}
        {demoMode && role !== 'manufacturer' ? <button className="btn outline" onClick={analyzeDemo} disabled={loading || !hasPackageImage}>
          {loading ? <RefreshCw className="spin" size={16} /> : <Camera size={16} />}
          {loading ? 'Analyzing...' : 'Run Demo Scan'}
        </button> : null}
      </div>
      {demoMode && role !== 'manufacturer' ? <div className="sample-picker demo-picker">
        <b>Demo Scenario:</b>
        {products.map(p => <button key={p.id} onClick={() => setProduct(p)} className={p.id === product.id ? 'active' : ''} disabled={loading}>{p.image} {p.name}</button>)}
      </div> : null}
    </section>
  );
}

function OfficerDashboard({ onNewScan, inspections, complaints }) {
  const nav = useNavigate();
  const totalInspections = inspections.length;
  const potentialFindings = inspections.flatMap((inspection) => inspection.violations || []).filter((finding) => !finding.officerDecision && ['POTENTIAL', 'POTENTIAL_NON_COMPLIANCE', 'REVIEW_REQUIRED', 'WARNING'].includes(finding.status)).length;
  const verifiedFindings = inspections.flatMap((inspection) => inspection.violations || []).filter((finding) => finding.officerDecision === 'VERIFIED').length;
  const underReinspection = inspections.filter((inspection) => inspection.status === 'UNDER_REINSPECTION').length;
  const pendingComplaints = complaints.filter((complaint) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.status)).length;
  const recentInspections = inspections.slice(0, 5);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ENFORCEMENT COMMAND CENTRE</span>
          <h1>Legal Metrology Officer Dashboard</h1>
          <p>Monitor package violations, audit consumer complaints, and execute statutory enforcement actions.</p>
        </div>
        <button className="btn primary" onClick={onNewScan}><Camera size={16} /> Start New Inspection</button>
      </div>

      <div className="stats">
        <article><b className="num">{totalInspections}</b><span>Total Inspections</span></article>
        <article><b className="num" style={{ color: 'var(--status-warn)' }}>{potentialFindings}</b><span>Potential / Review Findings</span></article>
        <article><b className="num" style={{ color: 'var(--status-good)' }}>{verifiedFindings}</b><span>Verified Findings</span></article>
        <article><b className="num" style={{ color: 'var(--status-warn)' }}>{underReinspection}</b><span>Under Re-inspection</span></article>
        <article><b className="num" style={{ color: 'var(--brand-primary)' }}>{pendingComplaints}</b><span>Pending Complaints</span></article>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Inspection Status Summary</h2>
          <div className="bars">
            <p><span>Potential / Review Findings</span><i className="amberbar" style={{ width: totalInspections ? `${Math.round((potentialFindings / totalInspections) * 100)}%` : '0%' }}></i><b className="num">{potentialFindings}</b></p>
            <p><span>Verified Findings</span><i className="redbar" style={{ width: totalInspections ? `${Math.round((verifiedFindings / totalInspections) * 100)}%` : '0%' }}></i><b className="num">{verifiedFindings}</b></p>
            <p><span>Under Re-inspection</span><i className="amberbar" style={{ width: totalInspections ? `${Math.round((underReinspection / totalInspections) * 100)}%` : '0%' }}></i><b className="num">{underReinspection}</b></p>
          </div>
        </section>

        <section className="panel">
          <h2>Enforcement Action Queue</h2>
          {potentialFindings ? <div className="alert" style={{ background: 'var(--status-warn-bg)', border: '1px solid var(--status-warn-border)' }}><AlertTriangle size={18} color="var(--status-warn)" /><div><strong style={{ color: 'var(--status-warn)', display: 'block' }}>Officer Review Required</strong><span>{potentialFindings} potential or review-required finding{potentialFindings === 1 ? '' : 's'} await an officer decision.</span></div></div> : <div className="empty"><CheckCircle2 /> No officer actions are pending.</div>}
        </section>
      </div>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2>Recent Field Inspections</h2>
          <button className="linkbtn" onClick={() => nav('/app/history')}>View Complete Register <ArrowRight size={14} /></button>
        </div>
        <table>
          <thead>
            <tr><th>Inspection ID</th><th>Product</th><th>Manufacturer</th><th>Inspection Date</th><th>Status</th><th>Findings</th></tr>
          </thead>
          <tbody>
            {recentInspections.length ? recentInspections.map((inspection) => <tr key={inspection.prototypeInspectionId}><td className="num">{inspection.id}</td><td>📦 {inspection.inspectionDetails?.productName || inspection.product?.name || 'Unidentified packaged commodity'}</td><td>{inspection.inspectionDetails?.responsibleParty || inspection.product?.manufacturer || 'Not detected'}</td><td className="num">{inspection.date}</td><td><span className={'badge ' + cls(inspection.status)}>{inspection.status.replace(/_/g, ' ')}</span></td><td className="num">{inspection.violations?.length || 0}</td></tr>) : <tr><td colSpan="6"><div className="empty">No completed inspections yet. Start a new inspection to create the first record.</div></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

function OfficerInspectionResult({ result, onUpdateStatus, onSaveInspection, onFindingDecision }) {
  const [violationsState, setViolationsState] = useState(result.violations);
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const nav = useNavigate();

  const handleDecision = async (idx, decision) => {
    setSaveError('');
    try {
      if (!result.prototypeInspectionId) throw new Error('Save the inspection before recording an officer decision.');
      await onFindingDecision(idx, decision, undefined, observation);
    } catch (error) {
      setSaveError(error.message);
      return;
    }
    const updated = [...violationsState];
    updated[idx].officerDecision = decision;
    setViolationsState(updated);
  };

  const modifyFinding = async (idx) => {
    const value = window.prompt('Modify extracted finding value:', violationsState[idx].detectedValue);
    if (value === null) return;
    setSaveError('');
    try {
      if (!result.prototypeInspectionId) throw new Error('Save the inspection before modifying a finding.');
      await onFindingDecision(idx, 'MODIFIED', value, observation);
    } catch (error) {
      setSaveError(error.message);
      return;
    }
    const updated = [...violationsState];
    updated[idx].detectedValue = value;
    updated[idx].officerDecision = 'MODIFIED';
    setViolationsState(updated);
  };

  return (
    <div className="result">
      <div className="result-head">
        <div className="product-art">{result.product.image}</div>
        <div>
          <span className="eyebrow">OFFICIAL FIELD AUDIT · <span className="num">{result.id}</span></span>
          <h1>{result.product.name}</h1>
          <p>{result.product.manufacturer} · {result.product.category} · Inspected on <span className="num">{result.date}</span></p>
        </div>
        <Seal score={result.score} statusLabel={result.status} tone={cls(result.status)} />
      </div>

      {result.product.location && (
        <div className="panel" style={{ margin: '18px 0', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <MapPin size={18} color="var(--brand-primary)" />
            <div>
              <strong>Point of Sale / Retail Outlet: </strong>
              <span style={{ color: 'var(--text-muted)' }}>{result.product.location}</span>
            </div>
          </div>
        </div>
      )}

      <section className="panel" style={{ margin: '18px 0' }}>
        <h2>Potential Findings & Evidence</h2>
        {violationsState.length > 0 ? (
          violationsState.map((v, idx) => (
            <article key={idx} className="panel" style={{ margin: '14px 0', padding: '20px', background: 'var(--bg-subtle)', borderLeft: '4px solid var(--status-bad)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="badge bad">{v.section}</span>
                  <h3 style={{ marginTop: '8px', fontSize: '16px' }}>{v.requirement}</h3>
                </div>
                {v.officerDecision ? (
                  <span className={'badge ' + (v.officerDecision === 'VERIFIED' ? 'bad' : 'good')}>
                    OFFICER {v.officerDecision}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => modifyFinding(idx)}>Modify Finding</button>
                    <button className="btn outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDecision(idx, 'REJECTED')}>Reject Finding</button>
                    <button className="btn primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDecision(idx, 'VERIFIED')}>Verify Finding</button>
                  </div>
                )}
              </div>

              <div style={{ margin: '14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#fff', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Extracted Packaging Finding:</small>
                  <strong style={{ color: 'var(--status-bad)' }}>"{v.detectedValue}"</strong>
                </div>
                <div style={{ background: '#fff', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <small style={{ color: 'var(--text-muted)', display: 'block' }}>Legal Requirement:</small>
                  <strong style={{ color: 'var(--status-good)' }}>{v.expectedValue}</strong>
                </div>
              </div>

              <p style={{ margin: '6px 0', fontSize: '13px' }}><b>Potential finding:</b> {v.explanation}</p>
              <p style={{ margin: '6px 0', fontSize: '13px', color: 'var(--text-muted)' }}><b>Legal Reference:</b> {v.ruleRef.law} — {v.ruleRef.section}</p>
              <p style={{ margin: '6px 0', fontSize: '13px', color: 'var(--brand-primary)' }}><b>Required Corrective Action:</b> {v.recommendation}</p>
              {v.evidence?.length ? <p style={{ margin: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}><b>Image evidence:</b> {v.evidence.map((item) => `“${item.text}”${item.source ? ` (${item.source})` : item.id ? ` (${item.id})` : ''}`).join(', ')}</p> : null}
            </article>
          ))
        ) : (
          <div className="empty"><CheckCircle2 /> No statutory declaration violations detected on this label.</div>
        )}
      </section>

      <ExtractedDeclarations declarations={result.analysis?.declarations || result.declarations} fallbackFields={result.product.fields} fallbackConfidence={result.product.confidence} />

      <section className="panel" style={{ margin: '18px 0', border: '1px solid var(--border-light)' }}>
        <span className="eyebrow">STATUTORY ENFORCEMENT DECISION</span>
        <h2>Issue Statutory Order</h2>
        <p>AI provides assisting evidence. Confirm violation findings or flag for re-inspection:</p>
        <label className="review">Officer observation<textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Add an inspection observation (kept in this review session)." /></label>
        {saveError ? <p className="error" role="alert">{saveError}</p> : null}
        <div className="result-actions" style={{ justifyContent: 'flex-start', gap: '12px', marginTop: '14px' }}>
          <button className="btn primary" onClick={async () => { setSaving(true); setSaveError(''); try { await onSaveInspection(); } catch (error) { setSaveError(error.message); } finally { setSaving(false); } }} disabled={saving || Boolean(result.prototypeInspectionId)}>
            {saving ? 'Saving Inspection...' : result.prototypeInspectionId ? 'Inspection Saved' : 'Save Inspection'}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saved locally on this prototype device. It is not a Supabase record.</span>
        </div>

        {result.review && (
          <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', margin: '12px 0' }}>
            <p style={{ margin: 0, fontSize: '12px' }}>
              <b>Officer in Charge:</b> {result.review.inspector} | <b>Timestamp:</b> {result.review.confirmedAt}
            </p>
          </div>
        )}

        <div className="result-actions" style={{ justifyContent: 'flex-start', gap: '12px', marginTop: '14px' }}>
          <button 
            className="btn primary" 
            style={{ background: 'var(--status-bad)' }} 
            onClick={() => onUpdateStatus('INSPECTOR_CONFIRMED_NON_COMPLIANT')}
          >
            <ShieldAlert size={16} /> [Confirm Non-Compliant]
          </button>
          <button 
            className="btn outline" 
            style={{ borderColor: 'var(--status-warn)', color: 'var(--status-warn)' }} 
            onClick={() => onUpdateStatus('UNDER_REINSPECTION')}
          >
            [Send for Re-inspection]
          </button>
          <button 
            className="btn outline" 
            onClick={() => nav('/app/report', { state: result })}
          >
            <FileText size={16} /> Generate Official Inspection Report
          </button>
        </div>
      </section>
    </div>
  );
}

function OfficerComplaintsView({ complaints }) {
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CONSUMER GRIEVANCE QUEUE</span>
          <h1>Consumer Complaints Register</h1>
          <p>Audit consumer reported label violations and trigger enforcement inspections.</p>
        </div>
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr><th>Complaint ID</th><th>Product</th><th>Reported Issue</th><th>Date</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {complaints.map(c => (
              <tr key={c.id}>
                <td className="num">{c.id}</td>
                <td><strong>{c.productName}</strong> ({c.brand})</td>
                <td>{c.issueType}</td>
                <td className="num">{c.date}</td>
                <td><span className={'badge ' + (c.status === 'SUBMITTED' ? 'bad' : 'warn')}>{c.status}</span></td>
                <td>
                  <button className="linkbtn" onClick={() => alert(`Initiating field inspection for ${c.productName}...`)}>
                    Initiate Audit <ArrowRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

const manufacturerDeclarationFields = [
  ['productName', 'Common / Generic Name'], ['netQuantity', 'Net Quantity'], ['mrp', 'MRP'], ['manufacturerPackerImporter', 'Manufacturer / Packer / Importer'], ['countryOfOrigin', 'Country of Origin'], ['packingDate', 'Manufacturing / Packing Date'], ['bestBefore', 'Best Before / Use By'], ['consumerCare', 'Consumer Care'], ['unitSalePrice', 'Unit Sale Price'],
];

const declarationGroups = [
  { label: 'Core Product Declarations', fields: ['productName', 'netQuantity', 'mrp'] },
  { label: 'Manufacturer & Origin', fields: ['manufacturerPackerImporter', 'countryOfOrigin'] },
  { label: 'Date & Validity', fields: ['packingDate', 'bestBefore'] },
  { label: 'Consumer Information', fields: ['consumerCare', 'unitSalePrice'] },
];

const declarationFieldByKey = Object.fromEntries(manufacturerDeclarationFields);
const legacyFieldLabels = { productName: 'Generic Name', manufacturerPackerImporter: 'Manufacturer' };
const fullWidthDeclarationKeys = new Set(['manufacturerPackerImporter', 'consumerCare']);

function declarationStatus(declaration) {
  if (declaration?.applicable === false) return { label: 'Not Applicable', tone: 'neutral' };
  if (!declaration?.value) return { label: 'Review Required', tone: 'warn' };
  if (declaration.status === 'POTENTIAL_NON_COMPLIANCE') return { label: 'Potential Non-Compliance', tone: 'bad' };
  return { label: 'Extracted', tone: 'good' };
}

function confidencePercent(confidence) {
  const numericConfidence = Number(confidence);
  if (!Number.isFinite(numericConfidence)) return null;
  return Math.round(numericConfidence <= 1 ? numericConfidence * 100 : numericConfidence);
}

function ExtractedDeclarations({ declarations = {}, fallbackFields = {}, fallbackConfidence = {} }) {
  const fieldFor = (key) => {
    const label = declarationFieldByKey[key];
    const declaration = declarations?.[key] || {};
    const fallbackValue = fallbackFields?.[label] ?? fallbackFields?.[legacyFieldLabels[key]];
    const value = declaration.value ?? fallbackValue ?? null;
    const confidence = declaration.confidence ?? fallbackConfidence?.[label] ?? fallbackConfidence?.[legacyFieldLabels[key]];
    const evidence = declaration.evidence ?? declaration.evidenceText ?? [];
    return { key, label, declaration: { ...declaration, value, confidence, evidence } };
  };

  return <section className="panel declaration-section" style={{ margin: '18px 0' }}>
    <div className="declaration-section-heading"><h2>Extracted Declarations</h2><p>Information detected from the submitted package artwork</p></div>
    {declarationGroups.map((group) => <div className="declaration-group" key={group.label}>
      <h3>{group.label}</h3>
      <div className="declaration-grid">
        {group.fields.map((key) => {
          const { label, declaration } = fieldFor(key);
          const status = declarationStatus(declaration);
          const evidence = declaration.evidence.map((item) => typeof item === 'string' ? item : item?.text).filter(Boolean).join(' ');
          const evidenceCopy = evidence || (status.tone === 'warn' ? 'Review the remaining package panels and complete artwork.' : 'No separate evidence text was returned for this declaration.');
          const isLongEvidence = evidenceCopy.length > 220;
          return <article className={`declaration-card ${fullWidthDeclarationKeys.has(key) ? 'declaration-card-wide' : ''} ${status.tone}`} key={key}>
            <div className="declaration-card-top"><h4>{label}</h4>{declaration.applicable === false ? <span className="applicability-indicator">Not Applicable</span> : null}</div>
            <p className={`declaration-value ${status.tone === 'warn' ? 'declaration-value-review' : ''}`}>{status.tone === 'neutral' ? 'Not applicable to this package' : declaration.value || 'Not detected in supplied package image'}</p>
            <div className="declaration-metadata"><span className={`badge ${status.tone === 'neutral' ? 'neutral' : status.tone}`}>{status.label}</span>{confidencePercent(declaration.confidence) != null ? <span className="confidence-badge">Confidence {confidencePercent(declaration.confidence)}%</span> : null}</div>
            <div className="declaration-evidence">{isLongEvidence ? <details><summary>Show evidence</summary><p>“{evidenceCopy}”</p></details> : <><span>Evidence</span><p>“{evidenceCopy}”</p></>}</div>
          </article>;
        })}
      </div>
    </div>)}
  </section>;
}

const manufacturerVersionsFor = (checks, productId) => checks.filter((check) => check.productId === productId).sort((a, b) => (a.artworkVersion || '').localeCompare(b.artworkVersion || '', undefined, { numeric: true }));
const versionReviewLabel = (check) => check.artworkVersion === 'V1' ? 'Initial Artwork' : 'Revised Artwork';

function VersionComparisonCard({ product, checks, onCompare }) {
  const versions = manufacturerVersionsFor(checks, product.id);
  if (versions.length < 2) return null;
  const previous = versions.at(-2);
  const revised = versions.at(-1);
  return <section className="version-comparison-card">
    <span className="eyebrow">VERSION COMPARISON</span>
    <h2>{product.name}</h2>
    <p>Track how packaging improves across artwork revisions.</p>
    <div className="version-progression"><article><b>{previous.artworkVersion} — {versionReviewLabel(previous)}</b><span className="num">{previous.score}/100</span><small>{previous.findings?.length || 0} finding{(previous.findings?.length || 0) === 1 ? '' : 's'}</small></article><ArrowRight size={22} /><article><b>{revised.artworkVersion} — {versionReviewLabel(revised)}</b><span className="num">{revised.score}/100</span><small>{revised.findings?.length || 0} finding{(revised.findings?.length || 0) === 1 ? '' : 's'}</small></article></div>
    <button className="btn primary compare-primary" onClick={() => onCompare(product.id, previous.manufacturerCheckId, revised.manufacturerCheckId)}><ArrowLeftRight size={17} /> Compare {previous.artworkVersion} ↔ {revised.artworkVersion}</button>
  </section>;
}

function ManufacturerDashboard({ onNewScan, products: manufacturerProducts, checks, onCompare, onRecommendations, onVersionComparison }) {
  const nav = useNavigate();
  const reviewRequired = checks.filter((check) => check.status === 'REVIEW_REQUIRED').length;
  const potentialIssues = checks.flatMap((check) => check.findings || []).filter((finding) => finding.status === 'POTENTIAL_NON_COMPLIANCE').length;
  const latest = [...checks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  return <>
    <div className="page-title"><div><span className="eyebrow">PREVENTIVE COMPLIANCE</span><h1>Manufacturer Compliance Centre</h1><p>Upload packaging artwork, identify potential issues, and save a review before release.</p></div><button className="btn primary" onClick={onNewScan}><Camera size={16} /> Start Packaging Compliance Check</button></div>
    <div className="stats">
      <article><b className="num">{manufacturerProducts.length}</b><span>Products / Artworks</span></article>
      <article><b className="num">{checks.length}</b><span>Compliance Checks</span></article>
      <article><b className="num" style={{ color: 'var(--status-warn)' }}>{reviewRequired}</b><span>Review Required</span></article>
      <article><b className="num" style={{ color: 'var(--status-bad)' }}>{potentialIssues}</b><span>Potential Issues</span></article>
      <article><b className="num" style={{ color: latest ? cls(latest.status) === 'good' ? 'var(--status-good)' : 'var(--status-warn)' : 'var(--text-muted)' }}>{latest ? `${latest.score}/100` : '—'}</b><span>Latest Compliance Score</span></article>
    </div>
    <section className="manufacturer-feature-grid"><article className="panel manufacturer-feature-card"><span className="eyebrow">CORRECTION RECOMMENDATIONS</span><h2>Turn findings into artwork updates</h2><p>Review deterministic rule-engine recommendations by saved product and artwork version.</p><button className="btn primary" onClick={onRecommendations}><AlertCircle size={16} /> Open Correction Recommendations</button></article><article className="panel manufacturer-feature-card"><span className="eyebrow">VERSION COMPARISON</span><h2>Measure revision progress</h2><p>Compare only saved artwork versions from the same product.</p><button className="btn outline" onClick={onVersionComparison}><ArrowLeftRight size={16} /> Open Version Comparison</button></article></section>
    <section className="panel"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}><h2>Recent Compliance Checks</h2><button className="linkbtn" onClick={() => nav('/app/history')}>Open Compliance History <ArrowRight size={14} /></button></div>
      <table><thead><tr><th>Product</th><th>Artwork Version</th><th>Date</th><th>Score</th><th>Status</th><th>Findings</th></tr></thead><tbody>{checks.length ? checks.slice(0, 5).map((check) => <tr key={check.id}><td>{check.productSnapshot?.name || 'Unidentified product'}</td><td className="num">{check.artworkVersion}</td><td className="num">{check.date}</td><td className="num">{check.score}/100</td><td><span className={'badge ' + cls(check.status)}>{check.status.replace(/_/g, ' ')}</span></td><td className="num">{check.findings?.length || 0}</td></tr>) : <tr><td colSpan="6"><div className="empty">No compliance checks yet.</div></td></tr>}</tbody></table>
    </section>
  </>;
}

function ManufacturerProductsPage({ products: manufacturerProducts, checks, onCheck, onOpen, onCompare, onRecommendations, onReport, onDelete }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const filtered = manufacturerProducts.filter((product) => `${product.name} ${product.brand || ''}`.toLowerCase().includes(query.toLowerCase()));
  const selected = manufacturerProducts.find((product) => product.id === selectedId);
  const deleteCandidate = manufacturerProducts.find((product) => product.id === deleteCandidateId);
  return <>
    <div className="page-title"><div><span className="eyebrow">PRODUCT ARTWORK LIBRARY</span><h1>Products & Artwork</h1><p>Open a saved product to submit revised artwork or inspect its version history.</p></div></div>
    <div className="filters"><Search size={16} /><input placeholder="Search product or brand..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {deleteSuccess ? <div className="success manufacturer-delete-success"><CheckCircle2 size={17} /> {deleteSuccess}</div> : null}
    <section className="panel"><table><thead><tr><th>Product</th><th>Current Version</th><th>Score</th><th>Status</th><th>Versions</th><th>Last Checked</th><th>Actions</th></tr></thead><tbody>{filtered.length ? filtered.map((product) => { const versions = manufacturerVersionsFor(checks, product.id); return <tr key={product.id}><td><strong>{product.name}</strong><br /><small>{product.brand || product.category || 'Extracted package context'}</small></td><td className="num">{product.currentArtworkVersion || '—'}</td><td className="num">{product.lastComplianceCheck?.score ?? '—'}{product.lastComplianceCheck ? '/100' : ''}</td><td>{product.lastComplianceCheck ? <span className={'badge ' + cls(product.lastComplianceCheck.status)}>{product.lastComplianceCheck.status.replace(/_/g, ' ')}</span> : '—'}</td><td className="num">{versions.length}</td><td>{product.lastComplianceCheck?.date || '—'}</td><td><div className="product-actions"><button className="linkbtn" onClick={() => setSelectedId(product.id)}>Open Product</button><button className="linkbtn" onClick={() => onCheck(product.id)}>Upload New Artwork</button><button className="linkbtn" onClick={() => setSelectedId(product.id)}>View History</button>{versions.length > 1 ? <button className="linkbtn" onClick={() => onCompare(product.id)}>Compare Versions</button> : null}<button className="linkbtn destructive-link" onClick={() => { setDeleteCandidateId(product.id); setDeleteError(''); }}>Delete Product</button></div></td></tr>; }) : <tr><td colSpan="7"><div className="empty"><FileText /> No products or artwork yet. Start a compliance check to create the first saved product.</div></td></tr>}</tbody></table></section>
    {selected ? (() => { const versions = manufacturerVersionsFor(checks, selected.id); const latest = versions.at(-1); return <section className="panel product-workspace" style={{ marginTop: '20px' }}><span className="eyebrow">PRODUCT COMPLIANCE WORKSPACE</span><h2>{selected.name}</h2><p>{selected.brand || selected.category || 'Saved package artwork'}</p><div className="product-workspace-summary"><article><small>Latest Version</small><b className="num">{latest?.artworkVersion || '—'}</b></article><article><small>Compliance Score</small><b className="num">{latest ? `${latest.score}/100` : '—'}</b></article><article><small>Status</small>{latest ? <span className={'badge ' + cls(latest.status)}>{latest.status.replace(/_/g, ' ')}</span> : <b>—</b>}</article></div><div className="result-actions product-workspace-actions"><button className="btn primary" onClick={() => onCheck(selected.id)}><Upload size={16} /> Upload New Artwork</button>{latest ? <button className="btn outline" onClick={() => onOpen(latest.manufacturerCheckId)}>View Latest Review</button> : null}{latest ? <button className="btn outline" onClick={() => onRecommendations(latest)}>View Recommendations</button> : null}{versions.length > 1 ? <button className="btn outline" onClick={() => onCompare(selected.id)}>Compare Versions</button> : null}{latest ? <button className="btn outline" onClick={() => onReport(latest)}>Generate Report</button> : null}</div>{versions.length > 1 ? <VersionComparisonCard product={selected} checks={checks} onCompare={onCompare} /> : <div className="empty">Upload revised artwork to begin the CHECK → CORRECT → RE-CHECK → COMPARE → IMPROVE lifecycle.</div>}<h2 style={{ marginTop: '24px' }}>Version Timeline</h2>{versions.length ? versions.map((check, index) => <div key={check.manufacturerCheckId} className="version-timeline-item"><div><b>{check.artworkVersion}</b><span>{index === 0 ? 'Initial Submission' : 'Revised Artwork'}</span></div><strong className="num">{check.score}/100</strong><span className={'badge ' + cls(check.status)}>{check.status.replace(/_/g, ' ')}</span><small>{check.findings?.length || 0} finding{(check.findings?.length || 0) === 1 ? '' : 's'} · {check.date}</small><button className="linkbtn" onClick={() => onOpen(check.manufacturerCheckId)}>Open Review</button></div>) : <div className="empty">No artwork has been uploaded for this product.</div>}</section>; })() : null}
    {deleteCandidate ? <div className="modal-backdrop" role="presentation"><section className="panel confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title"><span className="eyebrow">PERMANENT ACTION</span><h2 id="delete-product-title">Delete Product?</h2><p><b>{deleteCandidate.name}</b> and all of its saved Manufacturer records will be permanently removed.</p><p>This includes:</p><ul><li>Product information</li><li>All artwork versions</li><li>Saved compliance checks, findings and recommendations</li><li>Comparison references</li><li>Stored artwork images</li></ul>{deleteError ? <p className="error">{deleteError}</p> : null}<div className="result-actions confirmation-actions"><button className="btn outline" disabled={deleting} onClick={() => setDeleteCandidateId(null)}>Cancel</button><button className="btn danger" disabled={deleting} onClick={async () => { setDeleting(true); setDeleteError(''); try { await onDelete(deleteCandidate.id); setSelectedId(null); setDeleteCandidateId(null); setDeleteSuccess('Product deleted successfully.'); } catch (error) { setDeleteError(error.message || 'The product could not be deleted.'); } finally { setDeleting(false); } }}>{deleting ? 'Deleting Product...' : 'Delete Product'}</button></div></section></div> : null}
  </>;
}

function ManufacturerCheckStart({ products: manufacturerProducts, selectedProductId, onSelectProduct, onResult }) {
  const product = manufacturerProducts.find((item) => item.id === selectedProductId);
  const nextVersion = product ? Math.max(0, ...(product.artworks || []).map((artwork) => Number(artwork.versionNumber) || Number(String(artwork.version || '').replace(/^V/i, '')) || 0)) + 1 : null;
  return <><div className="page-title"><div><span className="eyebrow">PRE-MARKET COMPLIANCE CHECK</span><h1>{product ? 'Submit Revised Packaging' : 'Upload Packaging Artwork'}</h1><p>{product ? `Product: ${product.name}. This will be a new, independent ${`V${nextVersion}`} screening.` : 'Upload your package artwork for AI-assisted preliminary compliance screening.'}</p></div></div>
    {product ? <section className="panel" style={{ marginBottom: '20px' }}><div className="alert"><FileText size={18} color="var(--brand-primary)" /><div><strong>Previous Version: {product.currentArtworkVersion} — {product.currentArtworkVersion === 'V1' ? 'Initial Review' : 'Revised Packaging'}</strong><span>Previous score: {product.lastComplianceCheck?.score ?? '—'}/100 · Previous issues: {product.lastComplianceCheck?.findingCount ?? 0}</span></div></div></section> : null}
    <Scanner done={onResult} role="manufacturer" manufacturerProduct={product} />
  </>;
}

function ManufacturerResult({ result, onSave, onRecheck, onCompare, onRecommendations, onReport }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const declarations = result.declarations || result.analysis?.declarations || {};
  const findings = result.findings || result.violations || [];
  const screeningStatus = result.screeningStatus || (findings.length ? (findings.some((finding) => finding.status === 'POTENTIAL_NON_COMPLIANCE') ? 'POTENTIAL_NON_COMPLIANCE' : 'REVIEW_REQUIRED') : 'NO_OBVIOUS_ISSUE_DETECTED');
  const statusLabel = screeningStatus === 'NO_OBVIOUS_ISSUE_DETECTED' ? 'No obvious issue detected' : screeningStatus.replace(/_/g, ' ');
  const versionTitle = result.artworkVersion ? `${result.artworkVersion} — ${result.versionLabel || (result.artworkVersion === 'V1' ? 'Initial Packaging Review' : 'Revised Packaging')}` : 'UNSAVED ARTWORK';
  const [metadata, setMetadata] = useState({ name: result.productSnapshot?.name || result.product?.name || declarations.productName?.value || '', brand: result.productSnapshot?.brand || '', category: result.product?.category || '', responsibleParty: result.productSnapshot?.manufacturer || result.product?.manufacturer || declarations.manufacturerPackerImporter?.value || '' });
  return <div className="result"><div className="result-head"><div className="product-art">📦</div><div><span className="eyebrow">PACKAGING COMPLIANCE REVIEW · {versionTitle}</span><h1>{metadata.name || 'Unidentified packaged commodity'}</h1><p>Preliminary Compliance Score: <b className="num">{result.score} / 100</b> · Status: <b>{statusLabel}</b></p></div><Seal score={result.score} statusLabel={statusLabel} tone={cls(screeningStatus)} /></div>
    <section className="panel" style={{ margin: '18px 0' }}><p style={{ margin: 0 }}>AI-assisted preliminary compliance screening — officer verification may be required. Use this preventive review to correct artwork before release.</p></section>
    <ExtractedDeclarations declarations={declarations} />
    <section className="panel" style={{ margin: '18px 0' }}><h2>Findings, Evidence & Recommended Corrections</h2>{findings.length ? findings.map((finding) => <article key={finding.id || finding.rule_code} className="panel" style={{ margin: '14px 0', padding: '20px', background: 'var(--bg-subtle)', borderLeft: '4px solid var(--status-warn)' }}><span className="badge warn">{finding.status?.replace(/_/g, ' ')}</span><h3 style={{ margin: '10px 0 6px' }}>{finding.rule_name || finding.requirement}</h3><p><b>Rule:</b> {finding.rule_number || finding.section || 'Manual review'} · <b>Code:</b> {finding.rule_code || finding.ruleCode || 'Not specified'} · <b>Severity:</b> {finding.severity || 'Not specified'}</p><p><b>Legal requirement:</b> {finding.requirement}</p><p><b>What was detected:</b> {finding.detected_value ?? finding.detectedValue ?? 'Not detected in supplied package image'}</p>{finding.expected_value || finding.expectedValue ? <p><b>Expected:</b> {finding.expected_value || finding.expectedValue}</p> : null}<p><b>Evidence:</b> {finding.evidence?.length ? finding.evidence.map((item) => item.text || item).join(', ') : 'Review the supplied package image and complete artwork.'}</p><p><b>Confidence:</b> {finding.confidence != null ? `${finding.confidence}%` : 'Not available'}</p><p><b>Source:</b> {finding.source_url || finding.ruleRef?.url ? <a href={finding.source_url || finding.ruleRef?.url} target="_blank" rel="noreferrer">Open rule reference</a> : 'Rule repository reference'}</p><div className="alert" style={{ background: 'var(--brand-soft)' }}><AlertCircle size={18} color="var(--brand-primary)" /><div><strong>Recommended Correction</strong><span>{finding.recommendation || 'Manual review required — verify the applicable requirement.'}</span></div></div></article>) : <div className="empty"><CheckCircle2 /> No obvious issue detected in the supplied artwork. Review the full package before release.</div>}</section>
    <section className="panel correction-recommendations"><span className="eyebrow">ACTION REQUIRED</span><h2>Correction Recommendations</h2><p>Use these rule-engine recommendations to review and correct the artwork before a revised submission. Officer verification may be required.</p>{findings.length ? findings.map((finding) => <article key={`recommendation-${finding.id || finding.rule_code}`}><h3>WHAT NEEDS ATTENTION</h3><p><b>{finding.rule_name || finding.requirement}</b></p><h3>LEGAL REQUIREMENT</h3><p>{finding.rule_number || finding.section || 'Manual review'} · {finding.requirement}</p><h3>EVIDENCE</h3><p>{finding.evidence?.length ? finding.evidence.map((item) => item.text || item).join(', ') : finding.detected_value || finding.detectedValue || 'Review the supplied package image and complete artwork.'}</p><h3>RECOMMENDED CORRECTION</h3><p className="recommendation-copy">{finding.recommendation || 'Manual review required — verify the applicable requirement.'}</p><h3>NEXT STEP</h3><p>Correct or verify the complete packaging artwork, then submit revised artwork for a new independent preliminary compliance screening.</p></article>) : <div className="empty"><CheckCircle2 /> No correction recommendation was generated because no potential findings were returned by the screening.</div>}</section>
    {!result.manufacturerCheckId ? <section className="panel" style={{ margin: '18px 0' }}><h2>Confirm Product Context (Optional)</h2><p>We use extracted package information to create the saved product context. Edit only if the extraction needs clarification.</p><div className="inspection-fields">{[['name', 'Product Name'], ['brand', 'Brand'], ['category', 'Category'], ['responsibleParty', 'Manufacturer / Packer / Importer']].map(([key, label]) => <label key={key}>{label}<input value={metadata[key]} onChange={(event) => setMetadata({ ...metadata, [key]: event.target.value })} /></label>)}</div></section> : null}
    {result.manufacturerCheckId ? <section className="panel comparison-ready" style={{ margin: '18px 0' }}><b>{result.artworkVersion} Analysis Complete</b><p>{result.versionNumber > 1 ? 'Choose any two saved versions for this product to measure its compliance improvement.' : 'Review the saved correction recommendations, then submit revised artwork when ready.'}</p><div className="result-actions" style={{ justifyContent: 'flex-start' }}>{result.versionNumber > 1 ? <button className="btn primary" onClick={() => onCompare(result.productId)}><ArrowLeftRight size={16} /> Compare Versions</button> : null}<button className="btn outline" onClick={() => onRecommendations(result)}><AlertCircle size={16} /> View Correction Recommendations</button><button className="btn outline" onClick={() => onReport(result)}><FileText size={16} /> Generate Compliance Report</button></div></section> : null}
    {error ? <p className="error">{error}</p> : null}<div className="result-actions" style={{ justifyContent: 'flex-start' }}><button className="btn primary" disabled={saving || Boolean(result.manufacturerCheckId)} onClick={async () => { setSaving(true); setError(''); try { await onSave(metadata); } catch (saveError) { setError(saveError.message); } finally { setSaving(false); } }}>{saving ? 'Saving Review...' : result.manufacturerCheckId ? 'Compliance Review Saved' : 'Save Compliance Review'}</button>{result.manufacturerCheckId ? <button className="btn outline" onClick={onRecheck}><Upload size={16} /> Submit Revised Artwork</button> : null}</div>
  </div>;
}

const findingEvidence = (finding) => finding.evidence?.length ? finding.evidence.map((item) => item.text || item).join(', ') : finding.detected_value || finding.detectedValue || 'Review the supplied package image and complete artwork.';

function ManufacturerRecommendations({ products, checks, onOpen }) {
  const requested = useLocation().state;
  const [productId, setProductId] = useState(requested?.productId || 'all');
  const [version, setVersion] = useState(requested?.artworkVersion || 'all');
  const [status, setStatus] = useState('all');
  const filtered = checks.filter((check) => (productId === 'all' || check.productId === productId) && (version === 'all' || check.artworkVersion === version) && (status === 'all' || check.status === status));
  return <><div className="page-title"><div><span className="eyebrow">CORRECTION RECOMMENDATIONS</span><h1>Artwork Correction Recommendations</h1><p>Select a saved product and artwork version to review the deterministic screening recommendations.</p></div></div>
    <div className="filters manufacturer-filters"><select value={productId} onChange={(event) => { setProductId(event.target.value); setVersion('all'); }}><option value="all">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><select value={version} onChange={(event) => setVersion(event.target.value)}><option value="all">All artwork versions</option>{checks.filter((check) => productId === 'all' || check.productId === productId).map((check) => <option key={check.id} value={check.artworkVersion}>{check.productSnapshot?.name} — {check.artworkVersion}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(checks.map((check) => check.status))].map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}</select></div>
    {filtered.length ? filtered.map((check) => <section className="panel recommendation-check" key={check.id}><div className="recommendation-check-head"><div><span className="eyebrow">{check.artworkVersion} · {check.date}</span><h2>{check.productSnapshot?.name || 'Unidentified product'}</h2><p>{check.productSnapshot?.brand || 'Package artwork'} · Preliminary Compliance Score: <b className="num">{check.score}/100</b></p></div><span className={'badge ' + cls(check.status)}>{check.status.replace(/_/g, ' ')}</span></div>{check.findings?.length ? check.findings.map((finding) => <article className="recommendation-detail" key={finding.id || finding.rule_code}><h3>WHAT NEEDS ATTENTION</h3><p><b>{finding.rule_name || finding.requirement}</b></p><h3>LEGAL REQUIREMENT</h3><p>{finding.rule_number || finding.section || 'Manual review'} · {finding.requirement}</p><h3>EVIDENCE</h3><p>{findingEvidence(finding)}</p><h3>WHAT WAS DETECTED</h3><p>{finding.detected_value ?? finding.detectedValue ?? 'Not detected in supplied package image'}</p><h3>RECOMMENDED CORRECTION</h3><p className="recommendation-copy">{finding.recommendation || 'Manual review required — verify the applicable requirement.'}</p><h3>NEXT STEP</h3><p>Correct or verify the complete packaging artwork, then submit revised artwork for a new independent compliance screening.</p></article>) : <div className="empty"><CheckCircle2 /> No correction recommendations were generated for this saved screening.</div>}<button className="linkbtn" onClick={() => onOpen(check.manufacturerCheckId)}>Open Compliance Review <ArrowRight size={14} /></button></section>) : <section className="panel"><div className="empty"><FileText /> No saved compliance checks match these filters.</div></section>}
  </>;
}

function ManufacturerComparisonStart({ products, checks, onCompare }) {
  const [productId, setProductId] = useState('');
  const productChecks = manufacturerVersionsFor(checks, productId);
  const [previousId, setPreviousId] = useState('');
  const [revisedId, setRevisedId] = useState('');
  const previous = previousId || productChecks.at(-2)?.manufacturerCheckId || '';
  const revised = revisedId || productChecks.at(-1)?.manufacturerCheckId || '';
  return <><div className="page-title"><div><span className="eyebrow">VERSION COMPARISON</span><h1>Compare Artwork Versions</h1><p>Select one product, then choose any two independently saved versions to measure compliance improvement.</p></div></div>
    <section className="panel comparison-start"><label>Select Product<select value={productId} onChange={(event) => { setProductId(event.target.value); setPreviousId(''); setRevisedId(''); }}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>{productId && productChecks.length ? <><div className="version-selection-list">{productChecks.map((check) => <article key={check.id}><b>{check.artworkVersion}</b><span className="num">{check.score}/100</span><small>{check.findings?.length || 0} finding{(check.findings?.length || 0) === 1 ? '' : 's'} · {check.date}</small></article>)}</div>{productChecks.length > 1 ? <div className="comparison-selectors"><label>Left Version<select value={previous} onChange={(event) => setPreviousId(event.target.value)}>{productChecks.map((check) => <option key={check.id} value={check.manufacturerCheckId}>{check.artworkVersion} — {check.score}/100</option>)}</select></label><label>Right Version<select value={revised} onChange={(event) => setRevisedId(event.target.value)}>{productChecks.map((check) => <option key={check.id} value={check.manufacturerCheckId}>{check.artworkVersion} — {check.score}/100</option>)}</select></label></div> : <div className="empty">Submit revised artwork for this product to unlock comparison.</div>}{productChecks.length > 1 ? <button className="btn primary" disabled={!previous || !revised || previous === revised} onClick={() => onCompare(productId, previous, revised)}><ArrowLeftRight size={16} /> Compare {productChecks.find((check) => check.manufacturerCheckId === previous)?.artworkVersion} ↔ {productChecks.find((check) => check.manufacturerCheckId === revised)?.artworkVersion}</button> : null}</> : <div className="empty"><ArrowLeftRight /> Select a saved product to view its artwork versions.</div>}</section>
  </>;
}

function ManufacturerHistory({ checks, onOpen, onRecommendations, onReport }) {
  const [query, setQuery] = useState('');
  const filtered = checks.filter((check) => `${check.productSnapshot?.name || ''} ${check.artworkVersion}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-title"><div><span className="eyebrow">PREVENTIVE COMPLIANCE HISTORY</span><h1>Compliance History</h1><p>The central record of every saved artwork compliance check.</p></div></div><div className="filters"><Search size={16} /><input value={query} placeholder="Search product or artwork version..." onChange={(event) => setQuery(event.target.value)} /></div><section className="panel"><table><thead><tr><th>Product</th><th>Artwork Version</th><th>Date</th><th>Compliance Score</th><th>Status</th><th>Findings</th><th>Action</th></tr></thead><tbody>{filtered.length ? filtered.map((check) => <tr key={check.id}><td>{check.productSnapshot?.name}</td><td className="num">{check.artworkVersion}</td><td className="num">{check.date}</td><td className="num">{check.score}/100</td><td><span className={'badge ' + cls(check.status)}>{check.status.replace(/_/g, ' ')}</span></td><td className="num">{check.findings?.length || 0}</td><td className="history-actions"><button className="linkbtn" onClick={() => onOpen(check.id)}>Open Review</button>{check.findings?.length ? <button className="linkbtn" onClick={() => onRecommendations(check)}>View Recommendations</button> : null}<button className="linkbtn" onClick={() => onReport(check)}>Generate Report</button></td></tr>) : <tr><td colSpan="7"><div className="empty">No compliance checks yet.</div></td></tr>}</tbody></table></section></>;
}

function StoredArtworkImages({ imageReferences = [], version }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    let active = true;
    const objectUrls = [];
    const load = async () => {
      const loaded = await Promise.all(imageReferences.filter((reference) => reference.imageId).map(async (reference) => {
        try {
          const stored = await getImage(reference.imageId);
          if (!stored?.blob) return null;
          const url = URL.createObjectURL(stored.blob);
          objectUrls.push(url);
          return { ...reference, panel: stored.panel || reference.type, filename: stored.filename || reference.filename, url };
        } catch {
          return null;
        }
      }));
      if (active) setImages(loaded.filter(Boolean));
      else objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    setImages([]);
    load();
    return () => { active = false; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [imageReferences]);

  if (!images.length) return <div className="empty">Artwork image unavailable for this saved version.</div>;
  return <div className="version-image-grid">{images.map((image) => <figure key={image.imageId}><img src={image.url} alt={`${version} ${image.panel} artwork`} /><figcaption>{image.panel || 'Package artwork'} · {image.filename || 'Original filename unavailable'} · {version}</figcaption></figure>)}</div>;
}

function ManufacturerVersionComparison({ checks, productId, initialPreviousId, initialRevisedId, onOpen, onReport }) {
  const nav = useNavigate();
  const productChecks = checks.filter((check) => check.productId === productId).sort((a, b) => (a.artworkVersion || '').localeCompare(b.artworkVersion || '', undefined, { numeric: true }));
  const [previousId, setPreviousId] = useState(initialPreviousId || productChecks[0]?.manufacturerCheckId || '');
  const [revisedId, setRevisedId] = useState(initialRevisedId || productChecks.at(-1)?.manufacturerCheckId || '');
  const previous = productChecks.find((check) => check.manufacturerCheckId === previousId);
  const revised = productChecks.find((check) => check.manufacturerCheckId === revisedId);
  const comparison = previous && revised && previousId !== revisedId ? compareManufacturerComplianceChecks(previous, revised) : null;
  const labelFor = (check) => `${check.artworkVersion} — ${check.versionLabel || (check.artworkVersion === 'V1' ? 'Initial Packaging Review' : 'Revised Packaging')}`;
  const issue = (finding, kind) => <article key={`${kind}-${finding.id || finding.rule_code}`} className="comparison-issue"><span className={'badge ' + (kind === 'resolved' ? 'good' : 'warn')}>{kind === 'resolved' ? `Resolved in ${revised?.artworkVersion || 'right version'}` : kind === 'remaining' ? 'Still Requires Review' : `New Issue in ${revised?.artworkVersion || 'right version'}`}</span><h3>{finding.rule_name || finding.requirement}</h3><p><b>Rule:</b> {finding.rule_number || finding.section || 'Manual review'} · <b>Code:</b> {finding.rule_code || finding.ruleCode || 'Not specified'}</p>{kind !== 'resolved' ? <><p><b>{revised?.artworkVersion || 'Right version'} evidence:</b> {finding.evidence?.length ? finding.evidence.map((item) => item.text || item).join(', ') : finding.detected_value || finding.detectedValue || 'Review the supplied package image.'}</p><p><b>Correction recommendation:</b> {finding.recommendation || 'Manual review required — verify the applicable requirement.'}</p></> : <p>Absent from the right version’s independently saved screening findings.</p>}</article>;
  const imageCard = (check, label) => <div className="version-artwork"><h3>{check.artworkVersion} — {label}</h3><StoredArtworkImages imageReferences={check.imageReferences || []} version={check.artworkVersion} /></div>;
  if (productChecks.length < 2) return <div className="empty"><FileText /> Version comparison becomes available after a revised artwork version is scanned.</div>;
  return <div className="result"><div className="page-title"><div><span className="eyebrow">VERSION COMPARISON</span><h1>{previous?.productSnapshot?.name || revised?.productSnapshot?.name || 'Packaging Version Comparison'}</h1><p>{previous ? `${previous.artworkVersion} — ${versionReviewLabel(previous)}` : 'Earlier version'} vs {revised ? `${revised.artworkVersion} — ${versionReviewLabel(revised)}` : 'Revised version'}. Compares independently saved preliminary screening results; officer verification may be required.</p></div><button className="btn outline" onClick={() => nav('/app/comparison')}>Back to Version Comparison</button></div>
    <section className="panel comparison-selectors"><label>Earlier version<select value={previousId} onChange={(event) => setPreviousId(event.target.value)}>{productChecks.map((check) => <option key={check.id} value={check.manufacturerCheckId}>{labelFor(check)}</option>)}</select></label><label>Later version<select value={revisedId} onChange={(event) => setRevisedId(event.target.value)}>{productChecks.map((check) => <option key={check.id} value={check.manufacturerCheckId}>{labelFor(check)}</option>)}</select></label></section>
    {!comparison ? <div className="empty">Choose two different saved versions to compare.</div> : <><section className="comparison-header"><article><span className="eyebrow">{labelFor(previous)}</span><b className="num">Score: {previous.score}/100</b><span>Status: {previous.status.replace(/_/g, ' ')}</span><span>Findings: {previous.findings?.length || 0}</span><small>{previous.date}</small></article><ArrowLeftRight size={26} /><article><span className="eyebrow">{labelFor(revised)}</span><b className="num">Score: {revised.score}/100</b><span>Status: {revised.status.replace(/_/g, ' ')}</span><span>Findings: {revised.findings?.length || 0}</span><small>{revised.date}</small></article></section>
      <section className="panel"><h2>Score Change</h2><p>{previous.artworkVersion}: <b className="num">{previous.score}/100</b></p><p>{revised.artworkVersion}: <b className="num">{revised.score}/100</b></p><p className="comparison-score"><span>Actual change:</span> <span className={comparison.scoreChange > 0 ? 'positive' : comparison.scoreChange < 0 ? 'negative' : ''}>{comparison.scoreChange > 0 ? '+' : ''}{comparison.scoreChange} points</span></p><p>Status: {previous.status.replace(/_/g, ' ')} → {revised.status.replace(/_/g, ' ')}</p></section>
      <section className="panel"><h2>Artwork Comparison</h2><div className="comparison-images">{imageCard(previous, 'ORIGINAL ARTWORK')}{imageCard(revised, 'REVISED ARTWORK')}</div></section>
      <section className="panel version-timeline"><h2>Version Timeline</h2>{productChecks.map((check, index) => <div key={check.id}><b>{labelFor(check)}</b><span>{index === 0 ? 'Initial Submission → Compliance Review → Corrections Recommended' : 'Revised Submission → Compliance Review'}</span>{index < productChecks.length - 1 ? <ArrowRight size={16} /> : null}</div>)}</section>
      <section className="comparison-grid"><div className="panel"><h2>Issues Resolved ({comparison.resolved.length})</h2>{comparison.resolved.length ? comparison.resolved.map((item) => issue(item, 'resolved')) : <p>No prior findings were resolved in this comparison.</p>}</div><div className="panel"><h2>Issues Still Remaining ({comparison.remaining.length})</h2>{comparison.remaining.length ? comparison.remaining.map((item) => issue(item, 'remaining')) : <p>No findings remain under the same rule identity.</p>}</div><div className="panel"><h2>New Issues Detected ({comparison.newIssues.length})</h2>{comparison.newIssues.length ? comparison.newIssues.map((item) => issue(item, 'new')) : <p>No new rule findings were detected in the revised version.</p>}</div></section>
      <section className="panel"><h2>Declaration Comparison</h2><table><thead><tr><th>Declaration</th><th>{previous.artworkVersion}</th><th>{revised.artworkVersion}</th><th>Change</th><th>Status</th></tr></thead><tbody>{manufacturerDeclarationFields.map(([key, label]) => { const before = previous.declarations?.[key]?.value || 'Not detected in supplied package image'; const after = revised.declarations?.[key]?.value || 'Not detected in supplied package image'; const beforeMissing = before === 'Not detected in supplied package image'; const afterMissing = after === 'Not detected in supplied package image'; const status = beforeMissing && !afterMissing ? 'ADDED' : !beforeMissing && afterMissing ? 'REMOVED' : before !== after ? 'CHANGED' : 'UNCHANGED'; return <tr key={key}><td>{label}</td><td>{before}</td><td>{after}</td><td>{status === 'UNCHANGED' ? '—' : status[0] + status.slice(1).toLowerCase()}</td><td><span className={'badge ' + (status === 'ADDED' ? 'good' : status === 'UNCHANGED' ? 'neutral' : 'warn')}>{status}</span></td></tr>; })}</tbody></table></section>
      <div className="result-actions" style={{ justifyContent: 'flex-start' }}><button className="btn outline" onClick={() => onOpen(previous.manufacturerCheckId)}>Open {previous.artworkVersion}</button><button className="btn primary" onClick={() => onOpen(revised.manufacturerCheckId)}>Open {revised.artworkVersion}</button><button className="btn outline" onClick={() => onReport(comparison)}>Generate Comparison Report</button></div>
    </>}</div>;
}

const sellerListingFields = [['productName', 'Product Name'], ['netQuantity', 'Net Quantity'], ['mrp', 'Listed MRP'], ['manufacturerPackerImporter', 'Manufacturer / Packer / Importer'], ['countryOfOrigin', 'Country of Origin'], ['bestBefore', 'Best Before / Use By'], ['consumerCare', 'Consumer Care Details']];
const sellerInputKey = { productName: 'productName', netQuantity: 'netQuantity', mrp: 'listedMrp', manufacturerPackerImporter: 'manufacturer', countryOfOrigin: 'countryOfOrigin', bestBefore: 'bestBefore', consumerCare: 'consumerCare' };
const sellerEcommerceRule = CORE_RULES.find((rule) => rule.rule_code === 'LMPCR-R6-10-ECOMMERCE-DECLARATIONS');

function SellerDashboard({ audits, comparisons, onNewAudit, onHistory }) {
  const passed = audits.filter((audit) => audit.status === 'NO_OBVIOUS_ISSUE_DETECTED').length;
  const review = audits.filter((audit) => audit.status === 'REVIEW_REQUIRED').length;
  const potential = audits.filter((audit) => audit.status === 'POTENTIAL_NON_COMPLIANCE').length;
  const mismatches = comparisons.flatMap((comparison) => comparison.mismatches || []);
  return <><div className="page-title"><div><span className="eyebrow">E-COMMERCE SELLER DESK</span><h1>Marketplace Listing Compliance</h1><p>Verify listing information against the supplied package artwork before publishing.</p></div><button className="btn primary" onClick={onNewAudit}><Camera size={16} /> Start Listing Audit</button></div><div className="stats"><article><b className="num">{audits.length}</b><span>Listings Audited</span></article><article><b className="num" style={{ color: 'var(--status-good)' }}>{passed}</b><span>No Obvious Issue</span></article><article><b className="num" style={{ color: 'var(--status-warn)' }}>{review}</b><span>Review Required</span></article><article><b className="num" style={{ color: 'var(--status-bad)' }}>{potential}</b><span>Potential Issues</span></article><article><b className="num" style={{ color: 'var(--status-bad)' }}>{mismatches.length}</b><span>Listing–Package Mismatches</span></article></div><section className="panel"><h2>Seller verification workflow</h2><p>LIST → AUDIT → CORRECT → RE-CHECK. Saved audits and comparisons are independent marketplace records and do not mix with Manufacturer products.</p><div className="result-actions" style={{ justifyContent: 'flex-start' }}><button className="btn primary" onClick={onNewAudit}>Create Listing Audit</button><button className="btn outline" onClick={onHistory}>Open Listing History</button></div></section></>;
}

function SellerListingAuditForm({ onResult }) {
  const [form, setForm] = useState({ productName: '', brand: '', listingTitle: '', sku: '', category: '', listedMrp: '', sellingPrice: '', netQuantity: '', manufacturer: '', countryOfOrigin: '', packingDate: '', bestBefore: '', consumerCare: '', description: '' });
  const [images, setImages] = useState({}); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const update = (key, value) => setForm({ ...form, [key]: value });
  const addImage = async (role, file) => { if (!file) return; try { const stored = await saveSellerImage(file, { role }); setImages({ ...images, [role]: { ...stored, file } }); } catch (imageError) { setError(imageError.message); } };
  const run = async () => { const source = images.package?.file || images.main?.file || images.additional?.file; if (!source) { setError('Upload a main listing image or package image to run the live audit.'); return; } if (!isSupabaseConfigured) { setError('Live analysis is unavailable until public Supabase configuration is provided.'); return; } setLoading(true); setError(''); try { const analysis = await analyzePackageImage(source); const live = createLiveResult(analysis); const declarations = analysis.declarations || {}; const mismatches = [['mrp', 'listedMrp', 'MRP'], ['netQuantity', 'netQuantity', 'Net quantity']].flatMap(([key, input, label]) => { const listed = form[input]?.trim(); const extracted = declarations[key]?.value?.trim(); if (!listed || !extracted || listed.toLowerCase() === extracted.toLowerCase()) return []; return [{ rule_code: sellerEcommerceRule?.rule_code || 'LMPCR-R6-10-ECOMMERCE-DECLARATIONS', rule_number: sellerEcommerceRule?.rule_number || 'Rule 6(10)', rule_name: `${label} listing/package inconsistency`, requirement: sellerEcommerceRule?.requirement || 'Display mandatory declarations on the digital listing.', status: 'REVIEW_REQUIRED', severity: 'HIGH', detected_value: `Listing: ${listed}; package: ${extracted}`, expected_value: 'Listing information should match the supplied package declaration or be reviewed.', evidence: [{ text: `Listing field: ${listed}`, source: 'listing_metadata' }, ...(declarations[key]?.evidence || [])], recommendation: `Verify and correct the listing ${label.toLowerCase()} so it matches the package artwork before publishing.` }]; }); const findings = [...live.violations, ...mismatches]; const status = findings.some((finding) => finding.status === 'POTENTIAL_NON_COMPLIANCE') ? 'POTENTIAL_NON_COMPLIANCE' : findings.length ? 'REVIEW_REQUIRED' : 'NO_OBVIOUS_ISSUE_DETECTED'; const score = Math.max(0, live.score - mismatches.length * 5); onResult({ listing: form, declarations, findings, score, status, analysis, imageReferences: Object.entries(images).map(([role, image]) => ({ role, imageId: image.id, filename: image.filename, contentType: image.contentType })), source: 'LIVE_GEMINI_LISTING_AUDIT' }); } catch (auditError) { setError(auditError.message); } finally { setLoading(false); } };
  return <><div className="page-title"><div><span className="eyebrow">E-COMMERCE LISTING AUDIT</span><h1>Create Listing Audit</h1><p>Enter marketplace data and upload the actual listing or package image for AI-assisted preliminary screening.</p></div></div><section className="panel seller-form"><div className="inspection-fields">{[['productName','Product Name'],['brand','Brand'],['listingTitle','Listing Title'],['sku','SKU / Product ID'],['category','Category'],['listedMrp','Listed MRP'],['sellingPrice','Selling Price'],['netQuantity','Net Quantity'],['manufacturer','Manufacturer / Packer / Importer'],['countryOfOrigin','Country of Origin'],['packingDate','Manufacturing / Packing Date'],['bestBefore','Best Before / Use By'],['consumerCare','Consumer Care Details']].map(([key,label]) => <label key={key}>{label}<input value={form[key]} onChange={(event) => update(key,event.target.value)} /></label>)}<label className="inspection-remarks">Product Description<textarea value={form.description} onChange={(event) => update('description',event.target.value)} /></label></div><h2>Listing and package images</h2><div className="package-image-grid">{[['main','Main Product Image'],['additional','Additional Product Image'],['package','Package Image']].map(([role,label]) => <label key={role} className="package-image-slot"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => addImage(role,event.target.files?.[0])} />{images[role] ? <><FileText size={24}/><b>{images[role].filename}</b><span>Saved for this audit</span></> : <><Upload size={24}/><b>{label}</b><span>Upload image</span></>}</label>)}</div>{error ? <p className="error">{error}</p> : null}<div className="result-actions" style={{ justifyContent: 'flex-start' }}><button className="btn primary" disabled={loading} onClick={run}>{loading ? 'Running Live Audit...' : 'Run Listing Audit'}</button></div></section></>;
}

function SellerAuditResult({ result, onSave, onRecommendations, onReport }) {
  const [saved, setSaved] = useState(result.sellerAuditId ? result : null); const fields = sellerListingFields.map(([key,label]) => { const listingValue = result.listing[sellerInputKey[key]]; const packageValue = result.declarations[key]?.value; const value = listingValue || packageValue || 'Not provided'; const mismatch = listingValue && packageValue && listingValue.toLowerCase() !== packageValue.toLowerCase(); return { key,label,value,status: mismatch ? 'INCONSISTENT' : value === 'Not provided' ? 'MISSING' : 'PRESENT' }; });
  const audit = saved || result;
  return <div className="result"><div className="result-head"><div className="product-art">🛒</div><div><span className="eyebrow">LISTING COMPLIANCE AUDIT</span><h1>{result.listing.productName || result.declarations.productName?.value || 'Unidentified listing'}</h1><p>Audit date: {new Date().toLocaleDateString('en-IN')} · AI-assisted preliminary compliance screening</p></div><Seal score={result.score} statusLabel={result.status.replace(/_/g,' ')} tone={cls(result.status)} /></div><section className="panel"><h2>Listing Information</h2><table><thead><tr><th>Field</th><th>Listing / Package Value</th><th>Status</th></tr></thead><tbody>{fields.map((field) => <tr key={field.key}><td>{field.label}</td><td>{field.value}</td><td><span className={'badge ' + (field.status === 'PRESENT' ? 'good' : 'warn')}>{field.status}</span></td></tr>)}</tbody></table></section><section className="panel correction-recommendations"><span className="eyebrow">FINDINGS & RECOMMENDED CORRECTIONS</span><h2>Marketplace listing findings</h2>{result.findings.length ? result.findings.map((finding) => <article key={finding.id || finding.rule_code}><h3>WHAT NEEDS ATTENTION</h3><p><b>{finding.rule_name || finding.requirement}</b></p><h3>STATUS</h3><p>{finding.status?.replace(/_/g,' ') || 'Review Required'}</p><h3>LEGAL REQUIREMENT</h3><p>{finding.rule_number || finding.section || 'Manual review'} · {finding.requirement}</p><h3>WHAT WAS FOUND</h3><p>{finding.detected_value || finding.detectedValue || 'Review the listing.'}</p><h3>EVIDENCE</h3><p>{findingEvidence(finding)}</p><h3>RECOMMENDED CORRECTION</h3><p className="recommendation-copy">{finding.recommendation || 'Review and correct the listing before publishing.'}</p><h3>NEXT STEP</h3><p>Correct the marketplace listing or package artwork, then run a new independent listing audit.</p></article>) : <div className="empty"><CheckCircle2 /> No potential finding was returned by the implemented screening rules.</div>}</section><div className="result-actions" style={{ justifyContent:'flex-start' }}>{!saved ? <button className="btn primary" onClick={() => setSaved(onSave(result))}>Save Listing Audit</button> : <><button className="btn outline" onClick={() => onRecommendations(audit)}>View Findings</button><button className="btn outline" onClick={() => onReport(audit)}>Generate Report</button></>}</div></div>;
}

function SellerHistory({ audits, onOpen, onComparison, onReport }) { return <><div className="page-title"><div><span className="eyebrow">SAVED LISTING AUDITS</span><h1>Listing History</h1><p>The central record of every saved marketplace listing audit.</p></div></div><section className="panel"><table><thead><tr><th>Product</th><th>SKU</th><th>Audit Date</th><th>Compliance Score</th><th>Status</th><th>Findings</th><th>Actions</th></tr></thead><tbody>{audits.length ? audits.map((audit) => <tr key={audit.id}><td>{audit.listing?.productName || 'Unidentified listing'}</td><td>{audit.listing?.sku || '—'}</td><td>{audit.date}</td><td className="num">{audit.score}/100</td><td><span className={'badge ' + cls(audit.status)}>{audit.status.replace(/_/g,' ')}</span></td><td className="num">{audit.findings?.length || 0}</td><td className="history-actions"><button className="linkbtn" onClick={() => onOpen(audit)}>Open Audit</button><button className="linkbtn" onClick={() => onComparison(audit)}>Package ↔ Listing</button><button className="linkbtn" onClick={() => onOpen(audit)}>View Findings</button><button className="linkbtn" onClick={() => onReport(audit)}>Generate Report</button></td></tr>) : <tr><td colSpan="7"><div className="empty">No listing audits yet.</div></td></tr>}</tbody></table></section></>; }

function SellerListings({ audits, onOpen, onNewAudit }) { const listings = [...new Map(audits.map((audit) => [audit.listing?.sku || audit.listing?.productName || audit.id, audit])).values()]; return <><div className="page-title"><div><span className="eyebrow">MARKETPLACE LISTINGS</span><h1>Listings</h1><p>Current saved listing records. Open a listing to review its latest audit.</p></div><button className="btn primary" onClick={onNewAudit}>Create Listing Audit</button></div><section className="panel"><table><thead><tr><th>Product</th><th>SKU</th><th>Latest Audit</th><th>Score</th><th>Status</th><th>Action</th></tr></thead><tbody>{listings.length ? listings.map((audit) => <tr key={audit.id}><td>{audit.listing?.productName || 'Unidentified listing'}</td><td>{audit.listing?.sku || '—'}</td><td>{audit.date}</td><td className="num">{audit.score}/100</td><td><span className={'badge ' + cls(audit.status)}>{audit.status.replace(/_/g,' ')}</span></td><td><button className="linkbtn" onClick={() => onOpen(audit)}>Open Latest Audit</button></td></tr>) : <tr><td colSpan="6"><div className="empty">No listings yet. Start a Listing Audit to create the first saved record.</div></td></tr>}</tbody></table></section></>; }

function SellerPackageThumbnails({ references = [] }) {
  const [images, setImages] = useState([]);
  useEffect(() => { let active = true; const urls = []; Promise.all(references.map(async (reference) => { try { const image = await getSellerImage(reference.imageId); if (!image?.blob) return null; const url = URL.createObjectURL(image.blob); urls.push(url); return { ...reference, url }; } catch { return null; } })).then((loaded) => { if (active) setImages(loaded.filter(Boolean)); }); return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); }; }, [references]);
  if (!images.length) return <div className="empty">Package image unavailable for this comparison.</div>;
  return <div className="version-image-grid">{images.map((image) => <figure key={image.imageId}><img src={image.url} alt={`${image.role} package evidence`} /><figcaption>{image.role || 'Package image'} · {image.filename || 'Original filename unavailable'}</figcaption></figure>)}</div>;
}

function SellerComparisonResult({ comparison, onSave, onReport }) {
  const [saved, setSaved] = useState(comparison.comparisonId ? comparison : null); const record = saved || comparison;
  return <div className="result"><div className="result-head"><div className="product-art">↔</div><div><span className="eyebrow">PACKAGE ↔ LISTING COMPARISON</span><h1>{record.listing?.productName || 'Marketplace Listing'}</h1><p>AI-assisted preliminary comparison · {record.date || new Date().toLocaleDateString('en-IN')}</p></div><Seal score={record.score} statusLabel={record.status.replace(/_/g, ' ')} tone={cls(record.status)} /></div><section className="panel"><h2>Package Evidence</h2><SellerPackageThumbnails references={record.packageImageReferences || []} /></section><section className="panel"><h2>Field-by-field Comparison</h2><table><thead><tr><th>Field</th><th>Online Listing</th><th>Package</th><th>Status</th></tr></thead><tbody>{record.rows.map((row) => <tr key={row.key}><td>{row.label}</td><td>{row.listingValue}</td><td>{row.packageValue}</td><td><span className={'badge ' + (row.status === 'MATCH' ? 'good' : 'warn')}>{row.status.replace(/_/g, ' ')}</span></td></tr>)}</tbody></table></section><section className="panel correction-recommendations"><span className="eyebrow">POTENTIAL MISMATCHES</span><h2>Seller verification required</h2>{record.mismatches.length ? record.mismatches.map((item) => <article key={item.key}><h3>FIELD</h3><p><b>{item.label}</b></p><h3>ONLINE LISTING</h3><p>{item.listingValue}</p><h3>PACKAGE</h3><p>{item.packageValue}</p><h3>EVIDENCE</h3><p>Saved listing information and the supplied package image evidence.</p><h3>REASON</h3><p>{item.reason}</p><h3>RECOMMENDED CORRECTION</h3><p className="recommendation-copy">{item.recommendation}</p><h3>STATUS</h3><p>Potential Listing–Package Mismatch — seller verification required.</p></article>) : <div className="empty"><CheckCircle2 /> No deterministic value mismatch was identified in the supplied evidence.</div>}</section><div className="result-actions" style={{ justifyContent: 'flex-start' }}>{!saved ? <button className="btn primary" onClick={() => setSaved(onSave(comparison))}>Save Comparison</button> : <button className="btn outline" onClick={() => onReport(record)}>Generate Comparison Report</button>}</div></div>;
}

function SellerPackageComparison({ audits, comparisons, onResult }) {
  const requested = useLocation().state; const [auditId, setAuditId] = useState(requested?.id || ''); const [images, setImages] = useState({}); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const audit = audits.find((item) => item.id === auditId); const saved = comparisons.filter((item) => item.listingId === auditId);
  const addImage = async (role, file) => { if (!file) return; try { const stored = await saveSellerImage(file, { role }); setImages((current) => ({ ...current, [role]: stored })); } catch (imageError) { setError(imageError.message); } };
  const run = async () => { const source = images.principal || images.back || images.side || images.evidence; if (!audit) { setError('Select a saved listing audit first.'); return; } if (!source) { setError('Upload a package image to run the comparison.'); return; } if (!isSupabaseConfigured) { setError('Live package extraction is unavailable until public Supabase configuration is provided.'); return; } setLoading(true); setError(''); try { const stored = await getSellerImage(source.id); if (!stored?.blob) throw new Error('The uploaded package image could not be retrieved.'); const analysis = await analyzePackageImage(stored.blob); const outcome = compareSellerListingToPackage(audit.listing, analysis.declarations); onResult({ listingId: audit.id, listing: audit.listing, packageImageReferences: Object.entries(images).map(([role, image]) => ({ role, imageId: image.id, filename: image.filename, contentType: image.contentType })), packageDeclarations: analysis.declarations, ...outcome, source: 'LIVE_GEMINI_PACKAGE_LISTING_COMPARISON' }); } catch (comparisonError) { setError(comparisonError.message); } finally { setLoading(false); } };
  return <><div className="page-title"><div><span className="eyebrow">PACKAGE ↔ LISTING COMPARISON</span><h1>Verify Listing Against Physical Package</h1><p>Gemini extracts visible package declarations; LabelGuard compares them deterministically with the saved listing.</p></div></div><section className="panel comparison-start"><label>Select Saved Listing Audit<select value={auditId} onChange={(event) => setAuditId(event.target.value)}><option value="">Select a listing</option>{audits.map((item) => <option key={item.id} value={item.id}>{item.listing?.productName || 'Unidentified listing'} · {item.listing?.sku || 'No SKU'} · {item.date}</option>)}</select></label>{audit ? <div className="alert"><FileText size={18} color="var(--brand-primary)" /><div><strong>{audit.listing.productName}</strong><span>SKU: {audit.listing.sku || 'Not provided'} · Listed MRP: {audit.listing.listedMrp || 'Not provided'}</span></div></div> : null}<h2>Package Images</h2><div className="package-image-grid">{[['principal','Principal Display Panel'],['back','Back Panel'],['side','Side / Other Panel'],['evidence','Additional Evidence']].map(([role,label]) => <label className="package-image-slot" key={role}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => addImage(role,event.target.files?.[0])} />{images[role] ? <><FileText size={24}/><b>{images[role].filename}</b><span>Saved package evidence</span></> : <><Upload size={24}/><b>{label}</b><span>Upload image</span></>}</label>)}</div>{error ? <p className="error">{error}</p> : null}<div className="result-actions" style={{ justifyContent: 'flex-start' }}><button className="btn primary" disabled={loading} onClick={run}>{loading ? 'Extracting and Comparing...' : 'Run Package ↔ Listing Comparison'}</button></div>{audit && saved.length ? <div className="version-selection-list">{saved.map((item) => <article key={item.id}><b>{item.date}</b><span className="num">{item.score}/100</span><button className="linkbtn" onClick={() => onResult(item)}>Open saved comparison</button></article>)}</div> : null}</section></>;
}

function SellerComparisonReport() { const comparison = useLocation().state; if (!comparison) return <div className="empty">Open a saved comparison to generate its report.</div>; return <main className="report"><div className="report-top"><div className="brand"><ShieldCheck /> LabelGuard</div><button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button></div><span className="eyebrow">AI-ASSISTED PRELIMINARY PACKAGE ↔ LISTING COMPARISON</span><h1>{comparison.listing?.productName || 'Marketplace Listing'}</h1><p>SKU: {comparison.listing?.sku || 'Not provided'} · Comparison date: {comparison.date}</p><div className={'report-score ' + cls(comparison.status)}>Preliminary Comparison Score: {comparison.score}/100 · {comparison.status.replace(/_/g, ' ')}</div><h2>Field-by-field Comparison</h2><div className="fields report-fields">{comparison.rows.map((row) => <div key={row.key}><span>{row.label} · {row.status.replace(/_/g, ' ')}</span><strong>Listing: {row.listingValue}<br />Package: {row.packageValue}</strong></div>)}</div><h2>Potential Mismatches & Recommendations</h2>{comparison.mismatches.length ? comparison.mismatches.map((item) => <article className="report-finding" key={item.key}><strong>{item.label}</strong><p><b>Listing:</b> {item.listingValue}</p><p><b>Package:</b> {item.packageValue}</p><p><b>Recommendation:</b> {item.recommendation}</p></article>) : <p>No deterministic mismatch was identified in the supplied evidence.</p>}<p className="disclaimer">AI-assisted preliminary comparison. Missing text from a supplied panel is not proof that a declaration is absent from the complete package. Seller and authorised reviewer verification are required.</p></main>; }

function SellerReport() { const audit = useLocation().state; if (!audit) return <div className="empty">Open a saved listing audit to generate its report.</div>; return <main className="report"><div className="report-top"><div className="brand"><ShieldCheck /> LabelGuard</div><button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button></div><span className="eyebrow">AI-ASSISTED PRELIMINARY LISTING COMPLIANCE SCREENING</span><h1>{audit.listing?.productName || 'Marketplace Listing'}</h1><p>SKU: {audit.listing?.sku || 'Not provided'} · Audit date: {audit.date}</p><div className={'report-score ' + cls(audit.status)}>Preliminary Compliance Score: {audit.score}/100 · {audit.status.replace(/_/g,' ')}</div><h2>Listing Information</h2><div className="fields report-fields">{Object.entries(audit.listing || {}).filter(([,value]) => value).map(([key,value]) => <div key={key}><span>{key.replace(/([A-Z])/g,' $1')}</span><strong>{value}</strong></div>)}</div><h2>Findings and Recommended Corrections</h2>{audit.findings?.length ? audit.findings.map((finding) => <article className="report-finding" key={finding.id || finding.rule_code}><strong>{finding.rule_name || finding.requirement}</strong><p><b>Rule:</b> {finding.rule_number || finding.section || 'Manual review'} · {finding.rule_code || ''}</p><p><b>Evidence:</b> {findingEvidence(finding)}</p><p><b>Recommended correction:</b> {finding.recommendation || 'Review and correct the listing.'}</p></article>) : <p>No potential findings were returned by the implemented screening rules.</p>}<p className="disclaimer">AI-assisted preliminary compliance screening. It is not a final legal determination or complete coverage of Legal Metrology requirements.</p></main>; }

function ConsumerDashboard({ onNewScan }) {
  const nav = useNavigate();
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CITIZEN PORTAL</span>
          <h1>Check a Product Label</h1>
          <p>Scan any packaged product to understand if price, quantity, and manufacturer details are clearly printed.</p>
        </div>
        <button className="btn primary lg" onClick={onNewScan}><Camera size={18} /> Scan Product Now</button>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>How Consumer Check Works</h2>
          <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-muted)' }}>
            <li>Take a photo of the product front or back label.</li>
            <li>We automatically read mandatory price and quantity numbers.</li>
            <li>If any detail is missing or non-compliant, you will receive an alert explaining why.</li>
          </ol>
        </section>

        <section className="panel" style={{ background: 'var(--brand-soft)', borderColor: 'rgba(37, 99, 235, 0.2)' }}>
          <h2 style={{ color: 'var(--brand-primary)' }}>Notice a Violation?</h2>
          <p>If you suspect MRP overcharging or missing weights, submit a formal grievance for Legal Metrology Officer review.</p>
          <button className="btn primary" onClick={() => nav('/app/complaint')}>
            <MessageSquare size={16} /> Report a Suspected Issue
          </button>
        </section>
      </div>

      <section className="panel">
        <h2>Your Grievance Redressal Journey</h2>
        <div className="steps" style={{ marginTop: '16px' }}>
          <article><b className="num">1</b><h3>Scan Product</h3><p>Verify label declarations instantly.</p></article>
          <article><b className="num">2</b><h3>Submit Issue</h3><p>Upload details to the state portal.</p></article>
          <article><b className="num">3</b><h3>Officer Review</h3><p>Legal Metrology Officer audits the complaint.</p></article>
          <article><b className="num">4</b><h3>Action Taken</h3><p>Store inspection & statutory resolution.</p></article>
        </div>
      </section>

      <div style={{ padding: '0 32px 32px' }}>
        <NchCard />
      </div>
    </>
  );
}

function ConsumerComplaintForm({ onSubmit }) {
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Food & Grocery');
  const [issueType, setIssueType] = useState('Missing MRP');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newComp = {
      id: 'CMP-' + Math.floor(1000 + Math.random() * 9000),
      productName,
      brand,
      category,
      issueType,
      description,
      status: 'SUBMITTED',
      date: new Date().toLocaleDateString('en-IN')
    };
    onSubmit(newComp);
    setSubmitted(true);
  };

  return (
    <section className="formpanel">
      <span className="eyebrow">CITIZEN GRIEVANCE REGISTRATION</span>
      <h1>Report a Suspected Label Issue</h1>
      {submitted ? (
        <div className="success">
          <CheckCircle2 size={24} />
          <div>
            <h2 style={{ margin: 0, color: 'var(--status-good)' }}>Grievance Submitted Successfully</h2>
            <p style={{ margin: '4px 0 0' }}>Your mock reference ID is <b>CR-LG-2026-9921</b>. Assigned to Legal Metrology Officer.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Product Name<input required placeholder="e.g. PureDrop Cooking Oil" value={productName} onChange={e => setProductName(e.target.value)} /></label>
          <label>Brand Name<input required placeholder="e.g. Narmada Essentials" value={brand} onChange={e => setBrand(e.target.value)} /></label>
          <label>Category
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Food & Grocery</option>
              <option>Edible Oils</option>
              <option>Spices & Condiments</option>
              <option>Packaged Goods</option>
            </select>
          </label>
          <label>Suspected Issue Type
            <select value={issueType} onChange={e => setIssueType(e.target.value)}>
              <option>Missing Maximum Retail Price (MRP)</option>
              <option>Contradictory / Incorrect Net Quantity</option>
              <option>Missing Manufacturer / Packer Address</option>
              <option>Overcharging Above Printed MRP</option>
            </select>
          </label>
          <label>Description of Violation
            <textarea required placeholder="Explain what you observed on the package label..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <button className="btn primary wide">Submit Grievance to Legal Metrology</button>
        </form>
      )}
      <NchCard />
    </section>
  );
}

function HistoryPage({ role, onOpenInspection, inspections = [] }) {
  const [q, setQ] = useState('');
  const allResults = role === 'officer' ? inspections : products.map(makeMockResult);
  const filtered = allResults.filter(r => r.product.name.toLowerCase().includes(q.toLowerCase()));
  const nav = useNavigate();

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">{labels[role].toUpperCase()} AUDIT REGISTER</span>
          <h1>{role === 'officer' ? 'Inspection History' : 'Analysis Records'}</h1>
          <p>Search and review historical label assessments.</p>
        </div>
      </div>
      <div className="filters">
        <Search size={16} />
        <input placeholder="Search by product name..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr><th>Audit ID</th><th>Product</th><th>Manufacturer</th><th>Score</th><th>Status</th><th>Violations</th><th>Action</th></tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map(r => (
              <tr key={r.id}>
                <td className="num">{r.id}</td>
                <td>{r.product.image} {r.product.name}</td>
                <td>{r.product.manufacturer}</td>
                <td className="num">{r.score}/100</td>
                <td><span className={'badge ' + cls(r.status)}>{r.status.replace(/_/g, ' ')}</span></td>
                <td className="num">{r.violations.length}</td>
                <td>
                  <button className="linkbtn" onClick={() => r.prototypeInspectionId ? onOpenInspection(r.prototypeInspectionId) : nav('/app/report', { state: r })}>{r.prototypeInspectionId ? 'Open Inspection' : 'View Report'}</button>
                </td>
              </tr>
            )) : <tr><td colSpan="7"><div className="empty">No saved inspection records yet.</div></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ReportView() {
  const state = useLocation().state;
  const r = state || makeMockResult(products[1]);

  return (
    <main className="report">
      <div className="report-top">
        <div className="brand"><ShieldCheck /> LabelGuard</div>
        <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button>
      </div>
      <span className="eyebrow">STATUTORY LEGAL METROLOGY ASSESSMENT REPORT</span>
      <h1>{r.product.name}</h1>
      <p>Inspection Audit ID: <b className="num">{r.id}</b> · Date: <span className="num">{r.date}</span></p>
      
      <div className={'report-score ' + cls(r.status)}>
        Audit Score: {r.score}/100 · Status: {r.status.replace(/_/g, ' ')}
      </div>

      <h2>Principal Display Panel Declarations</h2>
      <div className="fields report-fields">
        {Object.entries(r.product.fields).map(([k, val]) => (
          <div key={k}><span>{k}</span><strong>{val}</strong></div>
        ))}
      </div>

      <h2>Statutory Rule Violations & Required Actions</h2>
      {r.violations.length > 0 ? (
        r.violations.map((v, i) => (
          <div key={i} style={{ marginBottom: '14px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <strong>{v.requirement} ({v.section})</strong>
            <p style={{ margin: '4px 0', fontSize: '13px' }}>Detected: <em>"{v.detectedValue}"</em> | Expected: {v.expectedValue}</p>
            <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--status-bad)' }}><b>Legal Issue:</b> {v.explanation}</p>
          </div>
        ))
      ) : (
        <p>No declaration issues identified under Legal Metrology (PCR) Rules, 2011.</p>
      )}

      {r.review && (
        <div style={{ marginTop: '20px', padding: '14px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
          <h3>Authorized Enforcement Signature</h3>
          <p style={{ margin: '2px 0' }}><b>Inspector:</b> {r.review.inspector}</p>
          <p style={{ margin: '2px 0' }}><b>Decision Timestamp:</b> {r.review.confirmedAt}</p>
        </div>
      )}

      <p className="disclaimer">Official Assessment generated by LabelGuard AI enforcement framework in accordance with Legal Metrology (Packaged Commodities) Rules, 2011.</p>
    </main>
  );
}

function Landing() {
  return (
    <main className="landing">
      <nav>
        <div className="brand"><ShieldCheck /> LabelGuard</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link className="btn ghost" to="/rules"><BookOpen size={16} /> Official Rules</Link>
          <Link className="btn primary" to="/login">Sign In</Link>
        </div>
      </nav>
      
      <section className="landing-hero">
        <div className="hero-pill">
          <Sparkles size={15} /> Next-Gen Legal Metrology Verification (SIH 2026)
        </div>
        <h1>Smart Label Compliance for Every <em>Packaged Commodity</em></h1>
        <p>AI-assisted declaration extraction and real-time rule verification designed for Metrology Officers, FMCG manufacturers, and e-commerce sellers.</p>
        
        <div className="hero-cta">
          <Link className="btn primary lg" to="/login">Start Compliance Check <ArrowRight size={18} /></Link>
          <Link className="btn outline lg" to="/rules">Browse Statutory Rules</Link>
        </div>

        <div className="hero-metrics-bar">
          <div className="metric-item"><b className="num">99.4%</b><span>OCR Extraction Accuracy</span></div>
          <div className="metric-item"><b className="num">&lt; 2.5s</b><span>Average Verification Speed</span></div>
          <div className="metric-item"><b className="num">100%</b><span>LMPC Rule Alignment</span></div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <span className="eyebrow">A SIMPLE, AUDITABLE PROCESS</span>
          <h2>From label upload to inspection insight in seconds</h2>
        </div>
        <div className="steps">
          {[['01', 'Upload / Scan', 'Capture image of product packaging or display panel.'],
            ['02', 'Extract Declarations', 'Precision OCR extracts Net Qty, MRP, Packer, and Origin.'],
            ['03', 'Apply Legal Rules', 'Instant evaluation against Legal Metrology (PCR) Rules, 2011.'],
            ['04', 'Act with Confidence', 'Export official reports, flag violations, or request re-inspections.']].map(x => (
            <article key={x[0]}>
              <b className="num">{x[0]}</b>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function PublicRulesPage() {
  return (
    <div className="landing" style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <nav>
        <Link className="brand" to="/"><ShieldCheck /> LabelGuard</Link>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link className="btn outline" to="/">Home</Link>
          <Link className="btn primary" to="/login">Sign In</Link>
        </div>
      </nav>
      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 24px' }}>
        <div className="page-title" style={{ padding: '0 0 24px' }}>
          <div>
            <span className="eyebrow">STATUTORY LEGAL FRAMEWORK</span>
            <h1>Official Rules & Packaging Acts</h1>
            <p>Plain-language statutory summaries and links to official documentation.</p>
          </div>
        </div>
        <section className="rules-list">
          {ruleSummaries.map(r => (
            <article className="panel" key={r.id} style={{ margin: '18px 0', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge good">{r.subtitle}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.source}</span>
              </div>
              <h2 style={{ fontSize: '22px', margin: '6px 0 10px' }}>{r.title}</h2>
              <div style={{ background: 'var(--bg-subtle)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--brand-primary)', marginBottom: '18px' }}>
                <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '4px' }}>Statutory Purpose:</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{r.simpleTakeaway}</span>
              </div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-main)', marginBottom: '10px' }}>Mandatory Compliance Points:</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                {r.keyPoints.map((pt, idx) => (
                  <li key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '5px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                    <Check size={16} color="var(--status-good)" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <a className="btn outline" href={r.url} target="_blank" rel="noopener noreferrer">
                  Open Official Reference Portal <ExternalLink size={13} />
                </a>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState('officer');

  return (
    <main className="login">
      <Link className="brand" to="/"><ShieldCheck /> LabelGuard</Link>
      <form onSubmit={(e) => {
        e.preventDefault();
        localStorage.setItem('lg-user', JSON.stringify({ role, name: creds[role].name }));
        nav('/app');
      }}>
        <span className="eyebrow">SIH PROTOTYPE ACCESS</span>
        <h1>Select Your Role</h1>
        <div className="roles">
          {Object.keys(labels).map(r => (
            <button type="button" onClick={() => setRole(r)} className={role === r ? 'selected' : ''} key={r}>
              {labels[r]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Choose a role to enter the LabelGuard prototype.</p>
        <button className="btn primary wide">Enter as {labels[role]}</button>
      </form>
    </main>
  );
}

function ManufacturerReportView() {
  const check = useLocation().state;
  if (!check) return <div className="empty"><FileText /> Open a saved compliance check from Compliance History to generate its report.</div>;
  const findings = check.findings || check.violations || [];
  return <main className="report"><div className="report-top"><div className="brand"><ShieldCheck /> LabelGuard</div><button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button></div><span className="eyebrow">AI-ASSISTED PRELIMINARY COMPLIANCE SCREENING</span><h1>{check.productSnapshot?.name || check.product?.name || 'Packaged commodity'}</h1><p>{check.productSnapshot?.brand || 'Package artwork'} · Artwork Version: <b className="num">{check.artworkVersion}</b> · Check Date: <span className="num">{check.date}</span></p><div className={'report-score ' + cls(check.status)}>Preliminary Compliance Score: {check.score}/100 · Status: {check.status.replace(/_/g, ' ')}</div><h2>Extracted Declarations</h2><div className="fields report-fields">{manufacturerDeclarationFields.map(([key, label]) => <div key={key}><span>{label}</span><strong>{check.declarations?.[key]?.value || 'Not detected in supplied package image'}</strong></div>)}</div><h2>Findings, Evidence & Recommended Corrections</h2>{findings.length ? findings.map((finding) => <article className="report-finding" key={finding.id || finding.rule_code}><strong>{finding.rule_name || finding.requirement}</strong><p><b>Rule reference:</b> {finding.rule_number || finding.section || 'Manual review'}{finding.rule_code || finding.ruleCode ? ` · ${finding.rule_code || finding.ruleCode}` : ''}</p><p><b>Evidence:</b> {findingEvidence(finding)}</p><p><b>What was detected:</b> {finding.detected_value ?? finding.detectedValue ?? 'Not detected in supplied package image'}</p><p><b>Recommended correction:</b> {finding.recommendation || 'Manual review required — verify the applicable requirement.'}</p><p><b>Next step:</b> Correct or verify the complete packaging artwork, then submit revised artwork for a new independent compliance screening.</p></article>) : <p>No potential findings were returned by this preliminary screening.</p>}<p className="disclaimer">AI-assisted preliminary compliance screening. The score is informational and is not a legally determined compliance percentage. Officer or authorised verification may be required.</p></main>;
}

function ManufacturerComparisonReportView() {
  const comparison = useLocation().state;
  if (!comparison?.previous || !comparison?.revised) return <div className="empty"><ArrowLeftRight /> Generate a comparison report from a completed version comparison.</div>;
  const { previous, revised, resolved, remaining, newIssues, scoreChange } = comparison;
  return <main className="report"><div className="report-top"><div className="brand"><ShieldCheck /> LabelGuard</div><button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button></div><span className="eyebrow">AI-ASSISTED PRELIMINARY VERSION COMPARISON</span><h1>{previous.productSnapshot?.name || revised.productSnapshot?.name || 'Packaging Version Comparison'}</h1><p>{previous.artworkVersion} ({previous.date}) ↔ {revised.artworkVersion} ({revised.date})</p><div className="report-score good">{previous.artworkVersion}: {previous.score}/100 · {revised.artworkVersion}: {revised.score}/100 · Score change: {scoreChange > 0 ? '+' : ''}{scoreChange}</div><h2>Finding Summary</h2><p><b>Resolved:</b> {resolved.length} · <b>Remaining:</b> {remaining.length} · <b>New:</b> {newIssues.length}</p><h2>Declaration Changes</h2><div className="fields report-fields">{manufacturerDeclarationFields.map(([key, label]) => <div key={key}><span>{label}</span><strong>{previous.artworkVersion}: {previous.declarations?.[key]?.value || 'Not detected'}<br />{revised.artworkVersion}: {revised.declarations?.[key]?.value || 'Not detected'}</strong></div>)}</div><h2>Finding Comparison</h2>{[['Resolved findings', resolved], ['Remaining findings', remaining], ['New findings', newIssues]].map(([title, findings]) => <section key={title}><h3>{title}</h3>{findings.length ? findings.map((finding) => <p key={finding.id || finding.rule_code}><b>{finding.rule_name || finding.requirement}</b> · {finding.rule_code || finding.ruleCode || finding.rule_number || finding.section}</p>) : <p>None.</p>}</section>)}<p className="disclaimer">AI-assisted preliminary comparison of independently saved screenings. Artwork references are retained with the saved version where available.</p></main>;
}

function AppShell() {
  const nav = useNavigate();
  const [scanResult, setScanResult] = useState();
  const [isConsumerScanning, setIsConsumerScanning] = useState(false);
  const [inspections, setInspections] = useState(getPrototypeInspections);
  const [complaints, setComplaints] = useState(getPrototypeComplaints);
  const [manufacturerProducts, setManufacturerProducts] = useState(getManufacturerProducts);
  const [manufacturerChecks, setManufacturerChecks] = useState(getManufacturerChecks);
  const [sellerAudits, setSellerAudits] = useState(getSellerAudits);
  const [sellerComparisons, setSellerComparisons] = useState(getSellerComparisons);
  const [activeManufacturerProductId, setActiveManufacturerProductId] = useState('');
  const [manufacturerComparison, setManufacturerComparison] = useState(null);
  const user = JSON.parse(localStorage.getItem('lg-user') || 'null');
  if (!user) return <Navigate to="/login" />;

  useEffect(() => {
    migrateLegacyManufacturerImages().then((migrated) => {
      if (!migrated) return;
      setManufacturerProducts(getManufacturerProducts());
      setManufacturerChecks(getManufacturerChecks());
    }).catch(() => {});
  }, []);

  const navConfig = {
    officer: [
      { label: 'Dashboard', path: '', icon: <LayoutDashboard size={17} /> },
      { label: 'New Inspection', path: 'scan', icon: <Camera size={17} /> },
      { label: 'Inspection History', path: 'history', icon: <HistoryIcon size={17} /> },
      { label: 'Complaints', path: 'complaints', icon: <MessageSquare size={17} />, badge: complaints.length },
    ],
    manufacturer: [
      { label: 'Dashboard', path: '', icon: <LayoutDashboard size={17} /> },
      { label: 'Products & Artwork', path: 'products', icon: <ClipboardCheck size={17} /> },
      { label: 'Start Compliance Check', path: 'scan', icon: <Camera size={17} /> },
      { label: 'Correction Recommendations', path: 'recommendations', icon: <AlertCircle size={17} /> },
      { label: 'Version Comparison', path: 'comparison', icon: <ArrowLeftRight size={17} /> },
      { label: 'Compliance History', path: 'history', icon: <HistoryIcon size={17} /> },
    ],
    seller: [
      { label: 'Dashboard', path: '', icon: <LayoutDashboard size={17} /> },
      { label: 'Listings', path: 'listings', icon: <ClipboardCheck size={17} /> },
      { label: 'Listing Audit', path: 'scan', icon: <Camera size={17} /> },
      { label: 'Package ↔ Listing Comparison', path: 'listing-comparison', icon: <ArrowLeftRight size={17} /> },
      { label: 'Bulk Listing Audit', path: 'bulk-listing-audit', icon: <ClipboardCheck size={17} /> },
      { label: 'Listing History', path: 'history', icon: <HistoryIcon size={17} /> },
    ],
    consumer: [
      { 
        label: 'Product Check', 
        path: '', 
        icon: <Camera size={17} />, 
        action: () => { 
          setScanResult(undefined); 
          setIsConsumerScanning(false); 
        } 
      },
      { label: 'My Grievances', path: 'complaint', icon: <MessageSquare size={17} /> },
    ],
  };

  const handleStatusUpdate = (newStatus) => {
    if (!scanResult) return;
    const updatedResult = {
      ...scanResult,
      status: newStatus,
      review: {
        inspector: user.name,
        confirmedAt: new Date().toLocaleString('en-IN')
      }
    };
    setScanResult(updatedResult);
    if (updatedResult.prototypeInspectionId) {
      updatePrototypeInspection(updatedResult.prototypeInspectionId, updatedResult);
      setInspections(getPrototypeInspections());
    }
    alert(`Status updated to: ${newStatus.replace(/_/g, ' ')}`);
  };

  const handleSaveInspection = async () => {
    if (!scanResult) return;
    const saved = savePrototypeInspection(scanResult);
    setScanResult(saved);
    setInspections(getPrototypeInspections());
  };

  const handleFindingDecision = async (index, decision, value, observation) => {
    const finding = scanResult?.violations?.[index];
    if (!finding?.id || !scanResult?.prototypeInspectionId) throw new Error('Save the inspection before recording an officer decision.');
    const updated = { ...scanResult, violations: scanResult.violations.map((item, itemIndex) => itemIndex === index ? { ...item, detectedValue: decision === 'MODIFIED' ? value : item.detectedValue, officerDecision: decision, officerObservation: observation || null } : item) };
    updatePrototypeInspection(updated.prototypeInspectionId, updated);
    setScanResult(updated);
    setInspections(getPrototypeInspections());
  };

  const handleOpenInspection = async (inspectionId) => {
    const inspection = getPrototypeInspections().find((record) => record.prototypeInspectionId === inspectionId);
    if (!inspection) throw new Error('This local prototype inspection could not be found.');
    setScanResult(inspection);
    nav('/app/scan');
  };

  const handleManufacturerScanResult = (result) => setScanResult(result);

  const handleSaveManufacturerCheck = async (metadata) => {
    const saved = saveManufacturerComplianceCheck(scanResult?.manufacturerProductId, scanResult, metadata);
    setScanResult(saved);
    setActiveManufacturerProductId(saved.productId);
    setManufacturerProducts(getManufacturerProducts());
    setManufacturerChecks(getManufacturerChecks());
  };

  const handleOpenManufacturerCheck = (checkId) => {
    const check = getManufacturerChecks().find((item) => item.manufacturerCheckId === checkId);
    if (!check) throw new Error('This saved compliance check could not be found.');
    setScanResult(check);
    setActiveManufacturerProductId(check.productId);
    nav('/app/scan');
  };

  const handleCompareManufacturerVersions = (productId, previousId, revisedId) => {
    const productVersions = getManufacturerChecks().filter((check) => check.productId === productId).sort((a, b) => (a.artworkVersion || '').localeCompare(b.artworkVersion || '', undefined, { numeric: true }));
    const selectedPreviousId = previousId || productVersions.at(-2)?.manufacturerCheckId;
    const selectedRevisedId = revisedId || productVersions.at(-1)?.manufacturerCheckId;
    const selected = productVersions.filter((check) => [selectedPreviousId, selectedRevisedId].includes(check.manufacturerCheckId));
    if (selected.length !== 2 || selectedPreviousId === selectedRevisedId) throw new Error('Select two different saved versions of the same product.');
    setManufacturerComparison({ productId, previousId: selectedPreviousId, revisedId: selectedRevisedId });
    nav('/app/compare');
  };

  const handleDeleteManufacturerProduct = async (productId) => {
    const deletion = await deleteManufacturerProduct(productId);
    if (!deletion.deleted) throw new Error('This saved product could not be found.');
    setManufacturerProducts(getManufacturerProducts());
    setManufacturerChecks(getManufacturerChecks());
    if (activeManufacturerProductId === productId) setActiveManufacturerProductId('');
    if (manufacturerComparison?.productId === productId) setManufacturerComparison(null);
    if (scanResult?.productId === productId || scanResult?.manufacturerProductId === productId) setScanResult(undefined);
    return deletion;
  };

  const handleSaveSellerAudit = (audit) => {
    const saved = saveSellerAudit(audit);
    setSellerAudits(getSellerAudits());
    setScanResult(saved);
    return saved;
  };

  const handleSaveSellerComparison = (comparison) => {
    const saved = saveSellerComparison(comparison);
    setSellerComparisons(getSellerComparisons());
    setScanResult(saved);
    return saved;
  };

  const currentNav = navConfig[user.role];

  return (
    <div className="shell">
      <aside>
        <Link className="brand" to="/app"><ShieldCheck /> LabelGuard</Link>
        <span className="rolelabel">{labels[user.role]}</span>

        {currentNav.map(item => (
          <NavLink 
            key={item.label} 
            to={'/app/' + item.path} 
            end={item.path === ''}
            onClick={() => {
              if (item.action) item.action();
              if (item.path === 'scan' || item.path === 'listing-comparison') setScanResult(undefined);
            }}
          >
            {item.icon}
            {item.label}
            {item.badge ? <span className="navbadge">{item.badge}</span> : null}
          </NavLink>
        ))}

        <button className="logout" onClick={() => { localStorage.removeItem('lg-user'); nav('/'); }}>
          <LogOut size={17} /> Logout
        </button>
      </aside>

      <div className="content">
        <header>
          <span>ACTIVE USER: <strong>{user.name}</strong> ({labels[user.role]}) · <b>PROTOTYPE MODE</b></span>
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge good">ONLINE</span>
            <span>🔔 <b className="num">2</b></span>
          </span>
        </header>

        <Routes>
          {user.role === 'officer' && (
            <>
              <Route index element={<OfficerDashboard onNewScan={() => { setScanResult(undefined); nav('/app/scan'); }} inspections={inspections} complaints={complaints} />} />
              <Route path="scan" element={scanResult ? (
                <OfficerInspectionResult result={scanResult} onUpdateStatus={handleStatusUpdate} onSaveInspection={handleSaveInspection} onFindingDecision={handleFindingDecision} />
              ) : (
                <>
                  <div className="page-title">
                    <div>
                      <span className="eyebrow">FIELD ENFORCEMENT AUDIT</span>
                      <h1>Start New Product Inspection</h1>
                      <p>Capture label display panel to extract declarations and verify statutory compliance.</p>
                    </div>
                  </div>
                  <Scanner done={setScanResult} role="officer" />
                </>
              )} />
              <Route path="complaints" element={<OfficerComplaintsView complaints={complaints} />} />
              <Route path="history" element={<HistoryPage role="officer" onOpenInspection={handleOpenInspection} inspections={inspections} />} />
            </>
          )}

          {user.role === 'manufacturer' && (
            <>
              <Route index element={<ManufacturerDashboard products={manufacturerProducts} checks={manufacturerChecks} onCompare={handleCompareManufacturerVersions} onRecommendations={() => nav('/app/recommendations')} onVersionComparison={() => nav('/app/comparison')} onNewScan={() => { setActiveManufacturerProductId(''); setScanResult(undefined); nav('/app/scan'); }} />} />
              <Route path="products" element={<ManufacturerProductsPage products={manufacturerProducts} checks={manufacturerChecks} onOpen={handleOpenManufacturerCheck} onCompare={handleCompareManufacturerVersions} onRecommendations={(check) => nav('/app/recommendations', { state: check })} onReport={(check) => nav('/app/manufacturer-report', { state: check })} onDelete={handleDeleteManufacturerProduct} onCheck={(productId) => { setActiveManufacturerProductId(productId); setScanResult(undefined); nav('/app/scan'); }} />} />
              <Route path="reviews" element={<Navigate to="/app/history" replace />} />
              <Route path="scan" element={scanResult ? <ManufacturerResult result={scanResult} onSave={handleSaveManufacturerCheck} onRecheck={() => setScanResult(undefined)} onCompare={handleCompareManufacturerVersions} onRecommendations={(check) => nav('/app/recommendations', { state: check })} onReport={(check) => nav('/app/manufacturer-report', { state: check })} /> : <ManufacturerCheckStart products={manufacturerProducts} selectedProductId={activeManufacturerProductId} onSelectProduct={setActiveManufacturerProductId} onResult={handleManufacturerScanResult} />} />
              <Route path="recommendations" element={<ManufacturerRecommendations products={manufacturerProducts} checks={manufacturerChecks} onOpen={handleOpenManufacturerCheck} />} />
              <Route path="comparison" element={<ManufacturerComparisonStart products={manufacturerProducts} checks={manufacturerChecks} onCompare={handleCompareManufacturerVersions} />} />
              <Route path="history" element={<ManufacturerHistory checks={manufacturerChecks} onOpen={handleOpenManufacturerCheck} onRecommendations={(check) => nav('/app/recommendations', { state: check })} onReport={(check) => nav('/app/manufacturer-report', { state: check })} />} />
              <Route path="compare" element={<ManufacturerVersionComparison checks={manufacturerChecks} productId={manufacturerComparison?.productId} initialPreviousId={manufacturerComparison?.previousId} initialRevisedId={manufacturerComparison?.revisedId} onOpen={handleOpenManufacturerCheck} onReport={(comparison) => nav('/app/comparison-report', { state: comparison })} />} />
              <Route path="manufacturer-report" element={<ManufacturerReportView />} />
              <Route path="comparison-report" element={<ManufacturerComparisonReportView />} />
            </>
          )}

          {user.role === 'seller' && (
            <>
              <Route index element={<SellerDashboard audits={sellerAudits} comparisons={sellerComparisons} onNewAudit={() => { setScanResult(undefined); nav('/app/scan'); }} onHistory={() => nav('/app/history')} />} />
              <Route path="listings" element={<SellerListings audits={sellerAudits} onOpen={(audit) => { setScanResult(audit); nav('/app/scan'); }} onNewAudit={() => { setScanResult(undefined); nav('/app/scan'); }} />} />
              <Route path="scan" element={scanResult ? <SellerAuditResult result={scanResult} onSave={handleSaveSellerAudit} onRecommendations={(audit) => setScanResult(audit)} onReport={(audit) => nav('/app/seller-report', { state: audit })} /> : <SellerListingAuditForm onResult={setScanResult} />} />
              <Route path="history" element={<SellerHistory audits={sellerAudits} onOpen={(audit) => { setScanResult(audit); nav('/app/scan'); }} onComparison={(audit) => { setScanResult(undefined); nav('/app/listing-comparison', { state: audit }); }} onReport={(audit) => nav('/app/seller-report', { state: audit })} />} />
              <Route path="seller-report" element={<SellerReport />} />
              <Route path="listing-comparison" element={(scanResult?.source === 'LIVE_GEMINI_PACKAGE_LISTING_COMPARISON' || scanResult?.comparisonId) ? <SellerComparisonResult comparison={scanResult} onSave={handleSaveSellerComparison} onReport={(comparison) => nav('/app/seller-comparison-report', { state: comparison })} /> : <SellerPackageComparison audits={sellerAudits} comparisons={sellerComparisons} onResult={setScanResult} />} />
              <Route path="seller-comparison-report" element={<SellerComparisonReport />} />
              <Route path="bulk-listing-audit" element={<div className="empty"><ClipboardCheck /> Bulk Listing Audit is reserved for Seller Phase 3.</div>} />
            </>
          )}

          {user.role === 'consumer' && (
            <>
              <Route index element={
                scanResult ? (
                  <div className="result">
                    <div className="result-head">
                      <div className="product-art">{scanResult.product.image}</div>
                      <div>
                        <span className="eyebrow">CITIZEN COMPLIANCE CHECK</span>
                        <h1>{scanResult.product.name}</h1>
                        <p>{scanResult.product.manufacturer}</p>
                      </div>
                      <Seal score={scanResult.score} statusLabel={scanResult.status === 'COMPLIANT' ? 'COMPLIANT' : 'NON COMPLIANT'} tone={cls(scanResult.status)} />
                    </div>

                    {scanResult.status !== 'COMPLIANT' && (
                      <div 
                        className="panel" 
                        style={{ 
                          margin: '18px 0', 
                          background: 'var(--status-bad-bg)', 
                          border: '2px solid var(--status-bad)', 
                          borderRadius: 'var(--radius-md)', 
                          padding: '20px' 
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <AlertCircle size={24} color="var(--status-bad)" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <h2 style={{ margin: '0 0 6px', color: 'var(--status-bad)', fontSize: '18px' }}>
                              Non-Compliance Alert Detected!
                            </h2>
                            <p style={{ margin: '0 0 12px', color: '#7f1d1d', fontSize: '14px', fontWeight: 600 }}>
                              This product packaging violates mandatory Indian Legal Metrology (Packaged Commodities) Rules:
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {scanResult.violations.map((v, i) => (
                                <div key={i} style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--status-bad)' }}>
                                  <strong style={{ color: 'var(--status-bad)', display: 'block', fontSize: '13px' }}>
                                    ⚠️ {v.requirement} ({v.section})
                                  </strong>
                                  <span style={{ fontSize: '13px', color: '#334155' }}>
                                    {v.explanation}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <section className="panel" style={{ margin: '18px 0' }}>
                      <h2>Essential Label Checklist</h2>
                      <div className="checklist">
                        {Object.entries(scanResult.product.fields).map(([k, val]) => {
                          const isMissing = val === 'Not detected';
                          return (
                            <p key={k}>
                              {isMissing ? <XCircle className="red" size={16} /> : <CheckCircle2 className="green" size={16} />}
                              <span>{k}</span>
                              <b>{isMissing ? 'MISSING' : val}</b>
                            </p>
                          );
                        })}
                      </div>
                    </section>

                    <div className="result-actions" style={{ justifyContent: 'flex-start', gap: '10px' }}>
                      {scanResult.status !== 'COMPLIANT' && (
                        <button className="btn primary" onClick={() => nav('/app/complaint')}>
                          Report This Violation to Officer
                        </button>
                      )}
                      <button className="btn outline" onClick={() => { setScanResult(undefined); setIsConsumerScanning(true); }}>
                        Scan Another Product
                      </button>
                    </div>

                    <NchCard />
                  </div>
                ) : isConsumerScanning ? (
                  <>
                    <div className="page-title">
                      <div>
                        <span className="eyebrow">CITIZEN SCANNER</span>
                        <h1>Check a Product Label</h1>
                        <p>Upload or take a photo of the product front or back label.</p>
                      </div>
                      <button className="btn outline" onClick={() => setIsConsumerScanning(false)}>Back to Portal</button>
                    </div>
                    <Scanner 
                      done={(res) => {
                        setScanResult(res);
                        setIsConsumerScanning(false);
                      }} 
                      role="consumer" 
                    />
                  </>
                ) : (
                  <ConsumerDashboard onNewScan={() => setIsConsumerScanning(true)} />
                )
              } />
              <Route path="complaint" element={<ConsumerComplaintForm onSubmit={(complaint) => { savePrototypeComplaint(complaint); setComplaints(getPrototypeComplaints()); }} />} />
            </>
          )}

          <Route path="report" element={<ReportView />} />
          <Route path="*" element={<Navigate to="/app" />} />
        </Routes>
      </div>
    </div>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/rules" element={<PublicRulesPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app/*" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Root;
