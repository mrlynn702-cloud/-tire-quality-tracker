import { useState, useMemo, useRef, useEffect } from "react";

const SUPABASE_URL = "https://xygvrhzvieulmexyjxuv.supabase.co";
const SUPABASE_KEY = "sb_publishable_wCNv0fp4POlUtncwJrug5g_6dNLyXbU";

const sbFetch = async (method, body) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/issues" + (method === "GET" ? "?select=*&order=created_at.desc" : ""), {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return method === "DELETE" ? null : res.json();
};

const BRANDS = ["Deestone", "Bluhorse"];
const PRODUCT_TYPES = ["Tire MC T/T", "Tire MC T/L", "Tire BC", "Tube MC", "Tube BC"];
const ISSUE_TYPES = ["บวม", "แตกร่องดอก", "แตกรอยต่อ", "จุ๊บหลุด", "อื่นๆ"];
const SHOP_TIERS = ["ร้านซื้อตรง", "ร้านค้าช่วง", "ร้านช่าง"];
const PROVINCES = ["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];
const BC = { Deestone: "#e63946", Bluhorse: "#1d4ed8" };

function initForm() {
  return {
    date: new Date().toISOString().split("T")[0],
    claimDate: "",
    claimRefNo: "",
    brand: "Deestone",
    productType: "Tire MC T/T",
    tireModel: "",
    tireSize: "",
    tireCount: "",
    issueType: "บวม",
    issueDetail: "",
    description: "",
    reporterName: "",
    shopName: "",
    shopTier: "ร้านซื้อตรง",
    distributorName: "",
    province: "กรุงเทพมหานคร",
    tireWeek: "",
    images: [],
    videos: [],
  };
}

const ST = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  card: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: 20 },
  inp: { background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", width: "100%", fontSize: 14 },
  btn: { cursor: "pointer", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  label: { fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 },
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caseCounter, setCaseCounter] = useState(1);

  useEffect(() => {
    sbFetch("GET").then(data => {
      const mapped = data.map(r => ({
        id: r.id,
        caseNo: r.case_no,
        date: r.date,
        claimDate: r.claim_date,
        claimRefNo: r.claim_ref_no,
        brand: r.brand,
        productType: r.product_type,
        tireModel: r.tire_model,
        tireSize: r.tire_size,
        tireCount: r.tire_count,
        tireWeek: r.tire_week,
        issueType: r.issue_type,
        issueDetail: r.issue_detail,
        description: r.description,
        reporterName: r.reporter_name,
        shopName: r.shop_name,
        shopTier: r.shop_tier,
        distributorName: r.distributor_name,
        province: r.province,
        images: r.images || [],
        videos: r.videos || [],
      }));
      setIssues(mapped);
      if (mapped.length > 0) setCaseCounter(mapped.length + 1);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const [form, setForm] = useState(initForm());
  const [search, setSearch] = useState("");
  const [fBrand, setFBrand] = useState("ทั้งหมด");
  const [fIssue, setFIssue] = useState("ทั้งหมด");
  const [fProd, setFProd] = useState("ทั้งหมด");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const imgRef = useRef();
  const vidRef = useRef();

  const showToast = (msg, type) => {
    setToast({ msg, type: type || "ok" });
    setTimeout(() => setToast(null), 3000);
  };

  const addFiles = (e, field) => {
    const files = Array.from(e.target.files);
    Promise.all(
      files.map(f => new Promise(res => {
        const r = new FileReader();
        r.onload = () => res({ name: f.name, url: r.result });
        r.readAsDataURL(f);
      }))
    ).then(res => setForm(p => ({ ...p, [field]: [...p[field], ...res] })));
  };

  const submit = async () => {
    if (!form.tireModel || !form.reporterName || !form.shopName) {
      showToast("กรุณากรอกข้อมูลที่จำเป็น", "err");
      return;
    }
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const caseNo = "C" + yy + mm + dd + String(caseCounter).padStart(3, "0");
    const payload = {
      case_no: caseNo,
      date: form.date,
      claim_date: form.claimDate,
      claim_ref_no: form.claimRefNo,
      brand: form.brand,
      product_type: form.productType,
      tire_model: form.tireModel,
      tire_size: form.tireSize,
      tire_count: form.tireCount,
      tire_week: form.tireWeek,
      issue_type: form.issueType,
      issue_detail: form.issueDetail,
      description: form.description,
      reporter_name: form.reporterName,
      shop_name: form.shopName,
      shop_tier: form.shopTier,
      distributor_name: form.distributorName,
      province: form.province,
      images: form.images,
      videos: form.videos,
    };
    try {
      const [saved] = await sbFetch("POST", payload);
      const newIssue = { ...form, id: saved.id, caseNo };
      setIssues(p => [newIssue, ...p]);
      setCaseCounter(c => c + 1);
      setForm(initForm());
      showToast("บันทึกสำเร็จ ✓");
      setView("list");
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const filtered = useMemo(() => issues.filter(i => {
    const q = search.toLowerCase();
    return (
      (!q || [i.tireModel, i.shopName, i.reporterName, i.province, i.issueType].some(v => v.toLowerCase().includes(q)))
      && (fBrand === "ทั้งหมด" || i.brand === fBrand)
      && (fIssue === "ทั้งหมด" || i.issueType === fIssue)
      && (fProd === "ทั้งหมด" || i.productType === fProd)
    );
  }), [issues, search, fBrand, fIssue, fProd]);

  const exportCSV = () => {
    const h = ["เลขเคส","เลขที่ใบเคลม","วันที่","วันที่รับเคลม","แบรนด์","ประเภทสินค้า","รุ่นยาง","ขนาด","จำนวนเส้น","ประเภทปัญหา","รายละเอียดปัญหา","หมายเหตุ","ผู้รายงาน","ร้านค้า","ประเภทร้าน","ร้านซื้อตรง","จังหวัดที่พบปัญหา","สัปดาห์ยาง"];
    const rows = filtered.map(i => [i.caseNo,i.claimRefNo,i.date,i.claimDate,i.brand,i.productType,i.tireModel,i.tireSize,i.tireCount,i.issueType,i.issueDetail,i.description,i.reporterName,i.shopName,i.shopTier,i.distributorName,i.province,i.tireWeek]);
    const csv = [h, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    a.download = "tire_quality.csv";
    a.click();
    showToast("Export CSV สำเร็จ");
  };

  const [preview, setPreview] = useState(null);

  const buildHTML = (issue) => {
    const brandColor = issue.brand === "Deestone" ? "#e63946" : "#1d4ed8";
    const imgTags = issue.images.map(img =>
      `<img src="${img.url}" style="width:160px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />`
    ).join("");
    const row = (label, value) =>
      `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;width:40%;border-bottom:1px solid #f1f5f9;">${label}</td><td style="padding:8px 12px;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">${value || "-"}</td></tr>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>รายงานเคส ${issue.caseNo}</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 32px; color: #1e293b; background: #fff; }
  .header { background: linear-gradient(135deg, #1a1d27, #2d3148); color: #fff; padding: 24px 28px; border-radius: 10px; margin-bottom: 16px; }
  .brand-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${brandColor}25; color: ${brandColor}; border: 1px solid ${brandColor}; }
  .case-no { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; background: rgba(99,102,241,0.2); color: #6366f1; border: 1px solid rgba(99,102,241,0.4); margin-bottom: 8px; }
  .tire-highlight { background: #fff; border: 2px solid ${brandColor}; border-radius: 10px; padding: 16px 20px; margin-bottom: 16px; display: flex; gap: 0; }
  .tire-cell { flex: 1; text-align: center; padding: 8px 12px; border-right: 1px solid #e2e8f0; }
  .tire-cell:last-child { border-right: none; }
  .tire-cell-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .tire-cell-value { font-size: 20px; font-weight: 800; color: #1e293b; }
  .section { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .section-title { background: #f8fafc; padding: 10px 14px; font-size: 11px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; }
  .images { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  @media print { .no-print { display: none !important; } body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">รายงานปัญหาคุณภาพยาง</div>
      <div class="case-no">${issue.caseNo}</div>
      <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
        <span class="brand-badge">${issue.brand}</span>
        <span style="font-size:12px;color:#94a3b8;">${issue.productType}</span>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#94a3b8;">วันที่พบปัญหา</div>
      <div style="font-size:18px;font-weight:700;color:#fff;">${issue.date}</div>
      ${issue.claimDate ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;">วันรับเคลม: ${issue.claimDate}</div>` : ""}
    </div>
  </div>
</div>

<div class="tire-highlight">
  <div class="tire-cell">
    <div class="tire-cell-label">รุ่นยาง</div>
    <div class="tire-cell-value" style="color:${brandColor};">${issue.tireModel || "-"}</div>
  </div>
  <div class="tire-cell">
    <div class="tire-cell-label">ขนาด (เบอร์ยาง)</div>
    <div class="tire-cell-value">${issue.tireSize || "-"}</div>
  </div>
  <div class="tire-cell">
    <div class="tire-cell-label">Tire Week</div>
    <div class="tire-cell-value">${issue.tireWeek || "-"}</div>
  </div>
  <div class="tire-cell">
    <div class="tire-cell-label">จำนวนเส้น</div>
    <div class="tire-cell-value">${issue.tireCount || "-"}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">ข้อมูลปัญหา</div>
  <table>
    ${row("ประเภทปัญหา", issue.issueType)}
    ${row("รายละเอียดปัญหา", issue.issueDetail)}
    ${row("หมายเหตุ", issue.description)}
  </table>
</div>
<div class="section">
  <div class="section-title">ข้อมูลร้านค้า</div>
  <table>
    ${row("เลขที่ใบเคลม", issue.claimRefNo)}
    ${row("ชื่อร้านค้า", issue.shopName)}
    ${row("ประเภทร้าน", issue.shopTier)}
    ${row("ร้านซื้อตรง", issue.distributorName)}
    ${row("จังหวัดที่พบปัญหา", issue.province)}
    ${row("ผู้รายงาน", issue.reporterName)}
  </table>
</div>
${issue.images.length > 0 ? `<div class="section"><div class="section-title">ภาพถ่าย (${issue.images.length} รูป)</div><div class="images">${imgTags}</div></div>` : ""}
<div class="footer">Tire Quality Tracker — Deestone &amp; Bluhorse &nbsp;|&nbsp; เลขเคส: ${issue.caseNo}</div>
</body></html>`;
  };

  const exportPDF = (issue) => {
    const html = buildHTML(issue);
    // Add toolbar with Save as PDF and Print buttons
    const toolbar = `<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#1a1d27;padding:12px 24px;display:flex;gap:10px;align-items:center;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
      <span style="color:#fff;font-weight:700;font-size:14px;flex:1;">📄 ${issue.caseNo} — ${issue.tireModel} ${issue.tireSize || ""}</span>
      <button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ พิมพ์</button>
      <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">💾 บันทึก PDF</button>
      <button onclick="window.close()" style="background:#475569;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:14px;cursor:pointer;">✕ ปิด</button>
    </div><div style="height:56px;"></div>`;
    const fullHTML = html.replace("<body>", "<body>" + toolbar);
    const win = window.open("", "_blank");
    win.document.write(fullHTML);
    win.document.close();
  };

  const total = issues.length;
  const itCounts = ISSUE_TYPES.map(t => ({ t, c: filtered.filter(i => i.issueType === t).length })).filter(x => x.c > 0).sort((a, b) => b.c - a.c);
  const ptCounts = PRODUCT_TYPES.map(t => ({ t, c: filtered.filter(i => i.productType === t).length }));
  const pvCounts = [...new Set(filtered.map(i => i.province))].map(p => ({ p, c: filtered.filter(i => i.province === p).length })).sort((a, b) => b.c - a.c).slice(0, 5);

  const needsDist = form.shopTier === "ร้านค้าช่วง" || form.shopTier === "ร้านช่าง";

  return (
    <div style={ST.page}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #6366f1 !important; }
        .rh:hover { background: #1e2235 !important; cursor: pointer; }
        @keyframes fu { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fu { animation: fu 0.35s ease both; }
        @keyframes si { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {loading && (
        <div style={{ position: "fixed", inset: 0, background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔧</div>
            <div style={{ fontSize: 16 }}>กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "err" ? "#ef4444" : "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, animation: "si 0.3s ease", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#e63946,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>Tire Quality Tracker</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Deestone & Bluhorse</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["dashboard","📊 Dashboard"],["form","➕ บันทึก"],["list","📋 รายการ"]].map(([v, l]) => (
              <button key={v} onClick={() => { setView(v); setSel(null); }}
                style={{ ...ST.btn, padding: "9px 16px", background: view === v ? "#6366f1" : "transparent", color: view === v ? "#fff" : "#94a3b8", border: view === v ? "none" : "1px solid #2d3148" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>ภาพรวมปัญหาคุณภาพยาง</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ข้อมูลทั้งหมด {total} รายการ</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input style={{ ...ST.inp, width: 220 }} placeholder="🔍 ค้นหา รุ่น, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...ST.inp, width: 150 }} value={fBrand} onChange={e => setFBrand(e.target.value)}>
                  <option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
                <select style={{ ...ST.inp, width: 160 }} value={fIssue} onChange={e => setFIssue(e.target.value)}>
                  <option>ทั้งหมด</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select style={{ ...ST.inp, width: 160 }} value={fProd} onChange={e => setFProd(e.target.value)}>
                  <option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {(search || fBrand !== "ทั้งหมด" || fIssue !== "ทั้งหมด" || fProd !== "ทั้งหมด") && (
                  <button onClick={() => { setSearch(""); setFBrand("ทั้งหมด"); setFIssue("ทั้งหมด"); setFProd("ทั้งหมด"); }}
                    style={{ ...ST.btn, background: "#334155", color: "#94a3b8", padding: "10px 14px" }}>✕ ล้าง</button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
              {[
                { l: "ทั้งหมด", v: filtered.length, icon: "📌", c: "#6366f1" },
                { l: "Deestone", v: filtered.filter(i => i.brand === "Deestone").length, icon: "🔴", c: "#e63946" },
                { l: "Bluhorse", v: filtered.filter(i => i.brand === "Bluhorse").length, icon: "🔵", c: "#1d4ed8" },
              ].map((s, i) => (
                <div key={i} style={{ ...ST.card, borderLeft: "4px solid " + s.c }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={ST.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>ประเภทปัญหาที่พบ</div>
                {itCounts.length === 0
                  ? <div style={{ color: "#475569", textAlign: "center", padding: "20px 0" }}>ยังไม่มีข้อมูล</div>
                  : itCounts.map((x, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                        <span>{x.t}</span><span style={{ fontWeight: 700 }}>{x.c}</span>
                      </div>
                      <div style={{ height: 6, background: "#2d3148", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: Math.min(100, (x.c / total) * 100) + "%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 3 }} />
                      </div>
                    </div>
                  ))
                }
              </div>
              <div style={ST.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>ประเภทสินค้า</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ptCounts.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f1117", borderRadius: 8, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{p.t}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: p.c > 0 ? "#6366f1" : "#475569" }}>{p.c}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={ST.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>จังหวัดที่พบปัญหาสูงสุด (Top 5)</div>
                {pvCounts.length === 0
                  ? <div style={{ color: "#475569", textAlign: "center", padding: "20px 0" }}>ยังไม่มีข้อมูล</div>
                  : pvCounts.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2d3148", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 13 }}>
                          <span>{p.p}</span><span style={{ fontWeight: 700 }}>{p.c}</span>
                        </div>
                        <div style={{ height: 4, background: "#2d3148", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: (p.c / pvCounts[0].c * 100) + "%", background: "linear-gradient(90deg,#e63946,#f59e0b)", borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div style={ST.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>แบ่งตามยาง Tire หรือ Tube</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { label: "Tire", color: "#6366f1", count: filtered.filter(i => i.productType.startsWith("Tire")).length },
                    { label: "Tube", color: "#f59e0b", count: filtered.filter(i => i.productType.startsWith("Tube")).length },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: "#0f1117", borderRadius: 10, padding: 20, textAlign: "center", borderLeft: "3px solid " + s.color }}>
                      <div style={{ fontSize: 36, fontWeight: 700, color: s.color }}>{s.count}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FORM */}
        {view === "form" && (
          <div className="fu" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>บันทึกปัญหาคุณภาพ</h2>
              <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กรอกข้อมูลให้ครบ <span style={{ color: "#ef4444" }}>*</span> = จำเป็น</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ข้อมูลพื้นฐาน */}
              <div style={ST.card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>ข้อมูลพื้นฐาน</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={ST.label}>แบรนด์ <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {BRANDS.map(b => (
                        <button key={b} onClick={() => setForm(p => ({ ...p, brand: b }))}
                          style={{ ...ST.btn, flex: 1, padding: 10, background: form.brand === b ? BC[b] : "#0f1117", color: "#fff", border: "2px solid " + (form.brand === b ? BC[b] : "#2d3148") }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={ST.label}>วันที่พบปัญหา <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="date" style={ST.inp} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>ประเภทสินค้า</label>
                    <select style={ST.inp} value={form.productType} onChange={e => setForm(p => ({ ...p, productType: e.target.value }))}>
                      {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={ST.label}>สัปดาห์ยาง (Tire Week)</label>
                    <input style={ST.inp} placeholder="เช่น 2524, W01/68" value={form.tireWeek} onChange={e => setForm(p => ({ ...p, tireWeek: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>รุ่นยาง <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={ST.inp} placeholder="เช่น D-268" value={form.tireModel} onChange={e => setForm(p => ({ ...p, tireModel: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>ขนาดยาง</label>
                    <input style={ST.inp} placeholder="เช่น 185/65R15" value={form.tireSize} onChange={e => setForm(p => ({ ...p, tireSize: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>จำนวนเส้นที่พบ</label>
                    <input type="number" min="1" style={ST.inp} placeholder="เช่น 3" value={form.tireCount} onChange={e => setForm(p => ({ ...p, tireCount: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ข้อมูลปัญหา */}
              <div style={ST.card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>ข้อมูลปัญหา</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={ST.label}>ประเภทปัญหา</label>
                    <select style={ST.inp} value={form.issueType} onChange={e => setForm(p => ({ ...p, issueType: e.target.value }))}>
                      {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={ST.label}>รายละเอียดปัญหา</label>
                    <input style={ST.inp} placeholder="ระบุรายละเอียดปัญหาเพิ่มเติม" value={form.issueDetail} onChange={e => setForm(p => ({ ...p, issueDetail: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>หมายเหตุเพิ่มเติม</label>
                    <textarea style={{ ...ST.inp, resize: "vertical" }} rows={3} placeholder="อธิบายเพิ่มเติม..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ข้อมูลร้านค้า */}
              <div style={ST.card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>ข้อมูลร้านค้า</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={ST.label}>วันที่รับยางเคลม</label>
                    <input type="date" style={ST.inp} value={form.claimDate} onChange={e => setForm(p => ({ ...p, claimDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ ...ST.label, color: "#f59e0b" }}>เลขที่ใบเคลม <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={{ ...ST.inp, borderColor: "#f59e0b" }} placeholder="เช่น CLM-2026-001" value={form.claimRefNo} onChange={e => setForm(p => ({ ...p, claimRefNo: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ST.label}>ชื่อร้านค้า <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={ST.inp} placeholder="ชื่อร้าน" value={form.shopName} onChange={e => setForm(p => ({ ...p, shopName: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={ST.label}>ประเภทร้าน (Tier)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {SHOP_TIERS.map(t => (
                        <button key={t} onClick={() => setForm(p => ({ ...p, shopTier: t, distributorName: t === "ร้านซื้อตรง" ? "" : p.distributorName }))}
                          style={{ ...ST.btn, flex: 1, padding: "10px 8px", background: form.shopTier === t ? "#6366f1" : "#0f1117", color: "#fff", border: "1.5px solid " + (form.shopTier === t ? "#6366f1" : "#2d3148") }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {needsDist && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ ...ST.label, color: "#f59e0b" }}>ลูกค้าของร้านซื้อตรง <span style={{ color: "#ef4444" }}>*</span></label>
                      <input style={{ ...ST.inp, borderColor: "#f59e0b" }} placeholder="ชื่อร้านซื้อตรงที่สังกัด" value={form.distributorName} onChange={e => setForm(p => ({ ...p, distributorName: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label style={ST.label}>จังหวัดที่พบปัญหา</label>
                    <select style={ST.inp} value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}>
                      {PROVINCES.map(pv => <option key={pv}>{pv}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={ST.label}>ผู้รายงาน <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={ST.inp} placeholder="ชื่อ-นามสกุล" value={form.reporterName} onChange={e => setForm(p => ({ ...p, reporterName: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ไฟล์แนบ */}
              <div style={ST.card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>ไฟล์แนบ</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={ST.label}>ภาพถ่าย</label>
                    <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addFiles(e, "images")} />
                    <button onClick={() => imgRef.current.click()} style={{ ...ST.btn, background: "#1e293b", color: "#94a3b8", padding: "10px 16px", border: "1.5px dashed #334155", width: "100%" }}>📷 เพิ่มภาพ</button>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {form.images.map((img, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img src={img.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />
                          <button onClick={() => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={ST.label}>วิดีโอ</label>
                    <input ref={vidRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={e => addFiles(e, "videos")} />
                    <button onClick={() => vidRef.current.click()} style={{ ...ST.btn, background: "#1e293b", color: "#94a3b8", padding: "10px 16px", border: "1.5px dashed #334155", width: "100%" }}>🎥 เพิ่มวิดีโอ</button>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {form.videos.map((v, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0f1117", borderRadius: 6, padding: "6px 10px" }}>
                          <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#94a3b8" }}>🎬 {v.name}</span>
                          <button onClick={() => setForm(p => ({ ...p, videos: p.videos.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={submit} style={{ ...ST.btn, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", padding: 14, fontSize: 16, width: "100%", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                ✓ บันทึกข้อมูล
              </button>
            </div>
          </div>
        )}

        {/* LIST */}
        {view === "list" && !sel && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>รายการปัญหาทั้งหมด</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>พบ {filtered.length} รายการ</p>
              </div>
              <button onClick={exportCSV} style={{ ...ST.btn, background: "#16a34a", color: "#fff", padding: "10px 20px" }}>📥 Export CSV</button>
            </div>
            <div style={{ ...ST.card, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ค้นหา</label>
                  <input style={ST.inp} placeholder="รุ่นยาง, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>แบรนด์</label>
                  <select style={ST.inp} value={fBrand} onChange={e => setFBrand(e.target.value)}>
                    <option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ประเภทปัญหา</label>
                  <select style={ST.inp} value={fIssue} onChange={e => setFIssue(e.target.value)}>
                    <option>ทั้งหมด</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ประเภทสินค้า</label>
                  <select style={ST.inp} value={fProd} onChange={e => setFProd(e.target.value)}>
                    <option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ ...ST.card, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1e2235", borderBottom: "1px solid #2d3148" }}>
                    {["เลขเคส","วันที่","แบรนด์","สินค้า","รุ่น / ขนาด","จำนวน","ปัญหา","ร้านค้า","จังหวัด","ผู้รายงาน"].map(h => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#475569" }}>ยังไม่มีข้อมูล — กด บันทึก เพื่อเพิ่มรายการแรก</td></tr>
                    : filtered.map((issue, i) => (
                      <tr key={issue.id} className="rh" onClick={() => setSel(issue)} style={{ borderBottom: "1px solid #1e2235", background: i % 2 === 0 ? "transparent" : "#14161f" }}>
                        <td style={{ padding: "12px 14px", color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>{issue.caseNo}</td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8", whiteSpace: "nowrap" }}>{issue.date}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: BC[issue.brand] + "25", color: BC[issue.brand] }}>{issue.brand}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.productType}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{issue.tireModel}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{issue.tireSize}</div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#e2e8f0", textAlign: "center" }}>{issue.tireCount || "-"}</td>
                        <td style={{ padding: "12px 14px", color: "#e2e8f0" }}>{issue.issueType}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ color: "#e2e8f0" }}>{issue.shopName}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{issue.shopTier}</div>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.province}</td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.reporterName}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {view === "list" && sel && (
          <div className="fu">
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => setSel(null)} style={{ ...ST.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← กลับรายการ</button>
              <button onClick={() => exportPDF(sel)} style={{ ...ST.btn, background: "#dc2626", color: "#fff", padding: "8px 20px" }}>📄 Export PDF</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ ...ST.card, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: BC[sel.brand] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔧</div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, marginBottom: 4 }}>{sel.caseNo}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{sel.tireModel} {sel.tireSize}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: BC[sel.brand] + "25", color: BC[sel.brand] }}>{sel.brand}</span>
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#2d3148", color: "#94a3b8" }}>{sel.productType}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", color: "#64748b", fontSize: 13 }}>
                  <div>{sel.date}</div>
                  <div>{sel.tireWeek}</div>
                </div>
              </div>
              {[
                { title: "ปัญหา", items: [["ประเภทปัญหา", sel.issueType], ["จำนวนเส้นที่พบ", sel.tireCount ? sel.tireCount + " เส้น" : "-"], ["รายละเอียดปัญหา", sel.issueDetail || "-"], ["หมายเหตุ", sel.description || "-"]] },
                { title: "ร้านค้า", items: [["เลขที่ใบเคลม", sel.claimRefNo || "-"], ["ชื่อร้าน", sel.shopName], ["ประเภทร้าน", sel.shopTier], ["ร้านซื้อตรง", sel.distributorName || "-"], ["จังหวัดที่พบปัญหา", sel.province], ["วันที่รับเคลม", sel.claimDate || "-"]] },
                { title: "ผู้รายงาน", items: [["ชื่อ", sel.reporterName]] },
              ].map((sec, i) => (
                <div key={i} style={ST.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{sec.title}</div>
                  {sec.items.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2235", fontSize: 14 }}>
                      <span style={{ color: "#64748b" }}>{k}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
              {sel.images.length > 0 && (
                <div style={ST.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>ภาพถ่าย ({sel.images.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {sel.images.map((img, i) => (
                      <img key={i} src={img.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148", cursor: "pointer" }} onClick={() => window.open(img.url, "_blank")} />
                    ))}
                  </div>
                </div>
              )}
              {sel.videos.length > 0 && (
                <div style={ST.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>วิดีโอ ({sel.videos.length})</div>
                  {sel.videos.map((v, i) => (
                    <video key={i} src={v.url} controls style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
