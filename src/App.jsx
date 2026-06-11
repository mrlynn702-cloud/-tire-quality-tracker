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
const SHOP_TIERS = ["ดิสทริบิวเตอร์", "โฮลเซลล์", "ร้านค้าช่วง", "ร้านช่าง"];
const NEEDS_DIST = ["ร้านค้าช่วง", "ร้านช่าง"];
const PROVINCES = ["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];
const BC = { Deestone: "#e63946", Bluhorse: "#1d4ed8" };

function initForm() {
  return {
    date: new Date().toISOString().split("T")[0],
    claimDate: "", claimRefNo: "", brand: "Deestone", productType: "Tire MC T/T",
    tireModel: "", tireSize: "", issueType: "บวม", issueDetail: "",
    reporterName: "", shopName: "", shopTier: "ดิสทริบิวเตอร์",
    distributorName: "", province: "กรุงเทพมหานคร", tireWeek: "", images: [],
  };
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input, select, textarea, button { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #6366f1; }
  .rh:hover { background: #1e2235 !important; cursor: pointer; }
  @keyframes fu { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .fu { animation: fu 0.35s ease both; }
  @keyframes si { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast { animation: si 0.3s ease; position: fixed; top: 20px; right: 20px; z-index: 9999; color: #fff; padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; }
  .toast-ok { background: #22c55e; }
  .toast-err { background: #ef4444; }
  .logo-icon { background: linear-gradient(135deg, #e63946, #1d4ed8); }
  .bar-purple { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .bar-orange { background: linear-gradient(90deg, #e63946, #f59e0b); }
  .btn-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; }
  .btn-green { background: linear-gradient(135deg, #22c55e, #16a34a) !important; }
  .loading-overlay { position: fixed; inset: 0; background: #0f1117; display: flex; align-items: center; justify-content: center; z-index: 9999; }
`;

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  card: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: 20 },
  inp: { background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", width: "100%", fontSize: 14 },
  btn: { cursor: "pointer", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  lbl: { fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 },
  hdr: { background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 24px" },
  hdrIn: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 },
  main: { maxWidth: 1200, margin: "0 auto", padding: 24 },
  secTitle: { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  flex: { display: "flex" },
  colFull: { gridColumn: "1 / -1" },
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caseCounter, setCaseCounter] = useState(1);
  const [form, setForm] = useState(initForm());
  const [previewMode, setPreviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [fBrand, setFBrand] = useState("ทั้งหมด");
  const [fIssue, setFIssue] = useState("ทั้งหมด");
  const [fProd, setFProd] = useState("ทั้งหมด");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const imgRef = useRef();

  const showToast = (msg, type) => {
    setToast({ msg, type: type || "ok" });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    sbFetch("GET").then(data => {
      const mapped = data.map(r => ({
        id: r.id, caseNo: r.case_no, date: r.date, claimDate: r.claim_date,
        claimRefNo: r.claim_ref_no, brand: r.brand, productType: r.product_type,
        tireModel: r.tire_model, tireSize: r.tire_size, tireWeek: r.tire_week,
        issueType: r.issue_type, issueDetail: r.issue_detail,
        reporterName: r.reporter_name, shopName: r.shop_name, shopTier: r.shop_tier,
        distributorName: r.distributor_name, province: r.province, images: r.images || [],
      }));
      setIssues(mapped);
      if (mapped.length > 0) setCaseCounter(mapped.length + 1);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addFiles = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, url: r.result });
      r.readAsDataURL(f);
    }))).then(res => setForm(p => ({ ...p, images: [...p.images, ...res] })));
  };

  const validateForm = () => {
    if (!form.tireModel) { showToast("กรุณากรอกรุ่นยาง", "err"); return false; }
    if (!form.reporterName) { showToast("กรุณากรอกผู้รายงาน", "err"); return false; }
    if (!form.shopName) { showToast("กรุณากรอกชื่อร้านค้า", "err"); return false; }
    if (NEEDS_DIST.includes(form.shopTier) && !form.distributorName) {
      showToast("กรุณากรอกร้านตัวแทนที่รับมา", "err"); return false;
    }
    return true;
  };

  const submit = async () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const caseNo = "C" + yy + mm + dd + String(caseCounter).padStart(3, "0");
    const payload = {
      case_no: caseNo, date: form.date, claim_date: form.claimDate,
      claim_ref_no: form.claimRefNo, brand: form.brand, product_type: form.productType,
      tire_model: form.tireModel, tire_size: form.tireSize, tire_week: form.tireWeek,
      issue_type: form.issueType, issue_detail: form.issueDetail,
      reporter_name: form.reporterName, shop_name: form.shopName, shop_tier: form.shopTier,
      distributor_name: form.distributorName, province: form.province,
      images: form.images.map(i => ({ name: i.name })),
    };
    try {
      const [saved] = await sbFetch("POST", payload);
      setIssues(p => [{ ...form, id: saved.id, caseNo }, ...p]);
      setCaseCounter(c => c + 1);
      setForm(initForm());
      setPreviewMode(false);
      showToast("บันทึกสำเร็จ");
      setView("list");
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const filtered = useMemo(() => issues.filter(i => {
    const q = search.toLowerCase();
    return (!q || [i.tireModel, i.shopName, i.reporterName, i.province, i.issueType].some(v => (v||"").toLowerCase().includes(q)))
      && (fBrand === "ทั้งหมด" || i.brand === fBrand)
      && (fIssue === "ทั้งหมด" || i.issueType === fIssue)
      && (fProd === "ทั้งหมด" || i.productType === fProd);
  }), [issues, search, fBrand, fIssue, fProd]);

  const exportCSV = () => {
    const h = ["เลขเคส","เลขที่ใบเคลม","วันที่","วันที่รับเคลม","แบรนด์","ประเภทสินค้า","รุ่นยาง","ขนาด","สัปดาห์ยาง/Serial","ประเภทปัญหา","รายละเอียดปัญหา","ผู้รายงาน","ร้านค้า","ประเภทร้าน","ร้านตัวแทน","จังหวัด"];
    const rows = filtered.map(i => [i.caseNo,i.claimRefNo,i.date,i.claimDate,i.brand,i.productType,i.tireModel,i.tireSize,i.tireWeek,i.issueType,i.issueDetail,i.reporterName,i.shopName,i.shopTier,i.distributorName,i.province]);
    const csv = [h,...rows].map(r => r.map(v => '"'+(v||"").toString().replace(/"/g,'""')+'"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv], {type:"text/csv"}));
    a.download = "tire_quality.csv";
    a.click();
    showToast("Export CSV สำเร็จ");
  };

  const exportPDF = (issue) => {
    const bColor = BC[issue.brand] || "#6366f1";
    const imgHTML = (issue.images||[]).filter(i=>i.url).map(img =>
      '<img src="'+img.url+'" style="width:160px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />'
    ).join("");
    const row = (lbl, val) =>
      '<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;width:40%;border-bottom:1px solid #f1f5f9;">'+lbl+'</td><td style="padding:8px 12px;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">'+(val||"-")+'</td></tr>';
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>'+issue.caseNo+'</title>'
      +'<style>body{font-family:sans-serif;margin:0;padding:32px;color:#1e293b}'
      +'.hdr{background:#1a1d27;color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}'
      +'.cn{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;background:#e0e7ff;color:#4338ca;border:1px solid #c7d2fe;margin-bottom:8px}'
      +'.bb{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700}'
      +'.hl{border:2px solid '+bColor+';border-radius:10px;padding:16px 20px;margin-bottom:16px;display:flex}'
      +'.tc{flex:1;text-align:center;padding:8px 12px;border-right:1px solid #e2e8f0}'
      +'.tc:last-child{border-right:none}'
      +'.tclbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}'
      +'.tcval{font-size:20px;font-weight:800;color:#1e293b}'
      +'.sec{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}'
      +'.sech{background:#f8fafc;padding:10px 14px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0}'
      +'table{width:100%;border-collapse:collapse}'
      +'.imgs{display:flex;flex-wrap:wrap;gap:10px;padding:12px}'
      +'.ftr{margin-top:32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}'
      +'@media print{.noprint{display:none!important}}</style></head><body>'
      +'<div class="noprint" style="position:fixed;top:0;left:0;right:0;background:#1a1d27;padding:12px 24px;display:flex;gap:10px;align-items:center;z-index:9999;">'
      +'<span style="color:#fff;font-weight:700;font-size:14px;flex:1;">'+issue.caseNo+' &mdash; '+issue.tireModel+' '+(issue.tireSize||'')+'</span>'
      +'<button onclick="window.print()" style="background:#6366f1;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">พิมพ์</button>'
      +'<button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">บันทึก PDF</button>'
      +'<button onclick="window.close()" style="background:#475569;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:14px;cursor:pointer;">ปิด</button>'
      +'</div><div style="height:56px"></div>'
      +'<div class="hdr"><div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">รายงานปัญหาคุณภาพยาง</div>'
      +'<div class="cn">'+issue.caseNo+'</div><br/>'
      +'<span class="bb" style="background:'+bColor+'25;color:'+bColor+';border:1px solid '+bColor+'">'+issue.brand+'</span>'
      +' <span style="font-size:12px;color:#94a3b8;">'+issue.productType+'</span>'
      +'</div><div style="text-align:right;">'
      +'<div style="font-size:11px;color:#94a3b8;">วันที่พบปัญหา</div>'
      +'<div style="font-size:18px;font-weight:700;color:#fff;">'+issue.date+'</div>'
      +(issue.claimDate ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">วันรับเคลม: '+issue.claimDate+'</div>' : '')
      +'</div></div>'
      +'<div class="hl">'
      +'<div class="tc"><div class="tclbl">รุ่นยาง</div><div class="tcval" style="color:'+bColor+';">'+(issue.tireModel||"-")+'</div></div>'
      +'<div class="tc"><div class="tclbl">ขนาด</div><div class="tcval">'+(issue.tireSize||"-")+'</div></div>'
      +'<div class="tc"><div class="tclbl">สัปดาห์ยาง/Serial</div><div class="tcval">'+(issue.tireWeek||"-")+'</div></div>'
      +'</div>'
      +'<div class="sec"><div class="sech">ข้อมูลปัญหา</div><table>'
      +row("ประเภทปัญหา", issue.issueType)
      +row("รายละเอียดปัญหา", issue.issueDetail)
      +'</table></div>'
      +'<div class="sec"><div class="sech">ข้อมูลร้านค้า</div><table>'
      +row("เลขที่ใบเคลม", issue.claimRefNo)
      +row("ชื่อร้านค้า", issue.shopName)
      +row("ประเภทร้าน", issue.shopTier)
      +row("ร้านตัวแทนที่รับมา", issue.distributorName)
      +row("จังหวัดที่พบปัญหา", issue.province)
      +row("วันที่รับยางเคลม", issue.claimDate)
      +row("ผู้รายงาน", issue.reporterName)
      +'</table></div>'
      +((issue.images||[]).filter(i=>i.url).length > 0 ? '<div class="sec"><div class="sech">ภาพถ่าย</div><div class="imgs">'+imgHTML+'</div></div>' : '')
      +'<div class="ftr">Tire Quality Tracker &mdash; Deestone &amp; Bluhorse | เลขเคส: '+issue.caseNo+'<br/>&copy; '+new Date().getFullYear()+' Deestone Co., Ltd. | Developed by Apiwich Ruangsrisoragrai &mdash; 2W</div>'
      +'</body></html>';
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const total = issues.length;
  const itCounts = ISSUE_TYPES.map(t => ({ t, c: filtered.filter(i => i.issueType === t).length })).filter(x => x.c > 0).sort((a,b) => b.c - a.c);
  const ptCounts = PRODUCT_TYPES.map(t => ({ t, c: filtered.filter(i => i.productType === t).length }));
  const pvCounts = [...new Set(filtered.map(i => i.province))].map(p => ({ p, c: filtered.filter(i => i.province === p).length })).sort((a,b) => b.c - a.c).slice(0,5);
  const needsDist = NEEDS_DIST.includes(form.shopTier);

  const navGo = (v) => { setView(v); setSel(null); setPreviewMode(false); };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {loading && (
        <div className="loading-overlay">
          <div style={{ textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔧</div>
            <div style={{ fontSize: 16 }}>กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      )}

      {toast && (
        <div className={"toast toast-" + toast.type}>{toast.msg}</div>
      )}

      <div style={S.hdr}>
        <div style={S.hdrIn}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="logo-icon" style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>Tire Quality Tracker</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Deestone &amp; Bluhorse</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["dashboard","📊 Dashboard"],["form","➕ บันทึก"],["list","📋 รายการ"]].map(([v,l]) => (
              <button key={v} onClick={() => navGo(v)}
                style={{ ...S.btn, padding: "9px 16px", background: view === v ? "#6366f1" : "transparent", color: view === v ? "#fff" : "#94a3b8", border: view === v ? "none" : "1px solid #2d3148" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={S.main}>

        {view === "dashboard" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>ภาพรวมปัญหาคุณภาพยาง</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ข้อมูลทั้งหมด {total} รายการ</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input style={{ ...S.inp, width: 220 }} placeholder="🔍 ค้นหา รุ่น, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...S.inp, width: 150 }} value={fBrand} onChange={e => setFBrand(e.target.value)}>
                  <option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
                <select style={{ ...S.inp, width: 160 }} value={fIssue} onChange={e => setFIssue(e.target.value)}>
                  <option>ทั้งหมด</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select style={{ ...S.inp, width: 160 }} value={fProd} onChange={e => setFProd(e.target.value)}>
                  <option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {(search || fBrand !== "ทั้งหมด" || fIssue !== "ทั้งหมด" || fProd !== "ทั้งหมด") && (
                  <button onClick={() => { setSearch(""); setFBrand("ทั้งหมด"); setFIssue("ทั้งหมด"); setFProd("ทั้งหมด"); }}
                    style={{ ...S.btn, background: "#334155", color: "#94a3b8", padding: "10px 14px" }}>ล้าง</button>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
              {[
                { l: "ทั้งหมด", v: filtered.length, icon: "📌", c: "#6366f1" },
                { l: "Deestone", v: filtered.filter(i => i.brand === "Deestone").length, icon: "🔴", c: "#e63946" },
                { l: "Bluhorse", v: filtered.filter(i => i.brand === "Bluhorse").length, icon: "🔵", c: "#1d4ed8" },
              ].map((s,i) => (
                <div key={i} style={{ ...S.card, borderLeft: "4px solid " + s.c }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>ประเภทปัญหาที่พบ</div>
                {itCounts.length === 0 ? <div style={{ color: "#475569", textAlign: "center", padding: "20px 0" }}>ยังไม่มีข้อมูล</div>
                  : itCounts.map((x,i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                        <span>{x.t}</span><span style={{ fontWeight: 700 }}>{x.c}</span>
                      </div>
                      <div style={{ height: 6, background: "#2d3148", borderRadius: 3, overflow: "hidden" }}>
                        <div className="bar-purple" style={{ height: "100%", width: Math.min(100, (x.c / filtered.length) * 100) + "%", borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>ประเภทสินค้า</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ptCounts.map((p,i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f1117", borderRadius: 8, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{p.t}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: p.c > 0 ? "#6366f1" : "#475569" }}>{p.c}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>จังหวัดที่พบปัญหาสูงสุด (Top 5)</div>
                {pvCounts.length === 0 ? <div style={{ color: "#475569", textAlign: "center", padding: "20px 0" }}>ยังไม่มีข้อมูล</div>
                  : pvCounts.map((p,i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2d3148", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 13 }}>
                          <span>{p.p}</span><span style={{ fontWeight: 700 }}>{p.c}</span>
                        </div>
                        <div style={{ height: 4, background: "#2d3148", borderRadius: 2 }}>
                          <div className="bar-orange" style={{ height: "100%", width: (p.c / pvCounts[0].c * 100) + "%", borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div style={S.card}>
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

        {view === "form" && !previewMode && (
          <div className="fu" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>บันทึกปัญหาคุณภาพ</h2>
              <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กรอกข้อมูลให้ครบ * = จำเป็น</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={S.card}>
                <div style={S.secTitle}>ข้อมูลพื้นฐาน</div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.lbl}>แบรนด์ *</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {BRANDS.map(b => (
                        <button key={b} onClick={() => setForm(p => ({ ...p, brand: b }))}
                          style={{ ...S.btn, flex: 1, padding: 10, background: form.brand === b ? BC[b] : "#0f1117", color: "#fff", border: "2px solid " + (form.brand === b ? BC[b] : "#2d3148") }}>{b}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={S.lbl}>วันที่พบปัญหา *</label>
                    <input type="date" style={S.inp} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>ประเภทสินค้า</label>
                    <select style={S.inp} value={form.productType} onChange={e => setForm(p => ({ ...p, productType: e.target.value }))}>
                      {PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>สัปดาห์ยาง / Serial Number</label>
                    <input style={S.inp} placeholder="เช่น 2524, SN-001" value={form.tireWeek} onChange={e => setForm(p => ({ ...p, tireWeek: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>รุ่นยาง *</label>
                    <input style={S.inp} placeholder="เช่น D-268" value={form.tireModel} onChange={e => setForm(p => ({ ...p, tireModel: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>ขนาดยาง</label>
                    <input style={S.inp} placeholder="เช่น 185/65R15" value={form.tireSize} onChange={e => setForm(p => ({ ...p, tireSize: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.secTitle}>ข้อมูลปัญหา</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={S.lbl}>ประเภทปัญหา</label>
                    <select style={S.inp} value={form.issueType} onChange={e => setForm(p => ({ ...p, issueType: e.target.value }))}>
                      {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>รายละเอียดปัญหา</label>
                    <input style={S.inp} placeholder="ระบุรายละเอียดเพิ่มเติม" value={form.issueDetail} onChange={e => setForm(p => ({ ...p, issueDetail: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.secTitle}>ข้อมูลร้านค้า</div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.lbl}>วันที่รับยางเคลม</label>
                    <input type="date" style={S.inp} value={form.claimDate} onChange={e => setForm(p => ({ ...p, claimDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>เลขที่ใบเคลม</label>
                    <input style={S.inp} placeholder="เช่น CLM-2026-001" value={form.claimRefNo} onChange={e => setForm(p => ({ ...p, claimRefNo: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.lbl}>ชื่อร้านค้า *</label>
                    <input style={S.inp} placeholder="ชื่อร้าน" value={form.shopName} onChange={e => setForm(p => ({ ...p, shopName: e.target.value }))} />
                  </div>
                  <div style={S.colFull}>
                    <label style={S.lbl}>ประเภทร้าน (Tier)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {SHOP_TIERS.map(t => (
                        <button key={t} onClick={() => setForm(p => ({ ...p, shopTier: t, distributorName: NEEDS_DIST.includes(t) ? p.distributorName : "" }))}
                          style={{ ...S.btn, flex: 1, padding: "10px 4px", fontSize: 12, background: form.shopTier === t ? "#6366f1" : "#0f1117", color: "#fff", border: "1.5px solid " + (form.shopTier === t ? "#6366f1" : "#2d3148") }}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {needsDist && (
                    <div style={S.colFull}>
                      <label style={{ ...S.lbl, color: "#f59e0b" }}>ร้านตัวแทนที่รับมา *</label>
                      <input style={{ ...S.inp, borderColor: "#f59e0b" }} placeholder="ชื่อร้านตัวแทน/ดิสทริบิวเตอร์" value={form.distributorName} onChange={e => setForm(p => ({ ...p, distributorName: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label style={S.lbl}>จังหวัดที่พบปัญหา</label>
                    <select style={S.inp} value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))}>
                      {PROVINCES.map(pv => <option key={pv}>{pv}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>ผู้รายงาน *</label>
                    <input style={S.inp} placeholder="ชื่อ-นามสกุล" value={form.reporterName} onChange={e => setForm(p => ({ ...p, reporterName: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.secTitle}>ภาพถ่าย</div>
                <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addFiles} />
                <button onClick={() => imgRef.current.click()} style={{ ...S.btn, background: "#1e293b", color: "#94a3b8", padding: "10px 16px", border: "1.5px dashed #334155", width: "100%" }}>📷 เพิ่มภาพ</button>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {form.images.map((img,i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />
                      <button onClick={() => setForm(p => ({ ...p, images: p.images.filter((_,j) => j !== i) }))}
                        style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10 }}>x</button>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn-indigo" onClick={() => { if(validateForm()) setPreviewMode(true); }}
                style={{ ...S.btn, color: "#fff", padding: 14, fontSize: 16, width: "100%" }}>
                👁️ Preview ก่อนบันทึก
              </button>
            </div>
          </div>
        )}

        {view === "form" && previewMode && (
          <div className="fu" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setPreviewMode(false)} style={{ ...S.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← แก้ไข</button>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Preview ก่อนบันทึก</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...S.card, borderLeft: "4px solid #6366f1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ display: "inline-flex", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: BC[form.brand] + "25", color: BC[form.brand] }}>{form.brand}</span>
                    <span style={{ display: "inline-flex", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#2d3148", color: "#94a3b8" }}>{form.productType}</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{form.date}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{form.tireModel} {form.tireSize}</div>
                <div style={{ fontSize: 13, color: "#6366f1" }}>สัปดาห์ยาง / Serial: {form.tireWeek || "-"}</div>
              </div>
              {[
                { title: "ปัญหา", items: [["ประเภทปัญหา", form.issueType], ["รายละเอียด", form.issueDetail||"-"]] },
                { title: "ร้านค้า", items: [["ร้านค้า", form.shopName], ["ประเภทร้าน", form.shopTier], ["ร้านตัวแทน", form.distributorName||"-"], ["จังหวัด", form.province], ["วันรับเคลม", form.claimDate||"-"], ["เลขที่ใบเคลม", form.claimRefNo||"-"], ["ผู้รายงาน", form.reporterName]] },
              ].map((sec,i) => (
                <div key={i} style={S.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{sec.title}</div>
                  {sec.items.map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1e2235", fontSize: 14 }}>
                      <span style={{ color: "#64748b" }}>{k}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
              {form.images.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 12, marginBottom: 12 }}>ภาพถ่าย ({form.images.length} รูป)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {form.images.map((img,i) => <img key={i} src={img.url} alt="" style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setPreviewMode(false)} style={{ ...S.btn, flex: 1, background: "#334155", color: "#fff", padding: 14, fontSize: 15 }}>← กลับแก้ไข</button>
                <button className="btn-green" onClick={submit} style={{ ...S.btn, flex: 2, color: "#fff", padding: 14, fontSize: 16 }}>
                  ✓ ยืนยันบันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "list" && !sel && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>รายการปัญหาทั้งหมด</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>พบ {filtered.length} รายการ</p>
              </div>
              <button onClick={exportCSV} style={{ ...S.btn, background: "#16a34a", color: "#fff", padding: "10px 20px" }}>📥 Export CSV</button>
            </div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ค้นหา</label><input style={S.inp} placeholder="รุ่นยาง, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>แบรนด์</label><select style={S.inp} value={fBrand} onChange={e => setFBrand(e.target.value)}><option>ทั้งหมด</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ปัญหา</label><select style={S.inp} value={fIssue} onChange={e => setFIssue(e.target.value)}><option>ทั้งหมด</option>{ISSUE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>สินค้า</label><select style={S.inp} value={fProd} onChange={e => setFProd(e.target.value)}><option>ทั้งหมด</option>{PRODUCT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
            </div>
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1e2235", borderBottom: "1px solid #2d3148" }}>
                    {["เลขเคส","วันที่","แบรนด์","สินค้า","รุ่น / ขนาด","ปัญหา","ร้านค้า","จังหวัด","ผู้รายงาน"].map(h => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#475569" }}>ยังไม่มีข้อมูล</td></tr>
                    : filtered.map((issue,i) => (
                      <tr key={issue.id} className="rh" onClick={() => setSel(issue)} style={{ borderBottom: "1px solid #1e2235", background: i % 2 === 0 ? "transparent" : "#14161f" }}>
                        <td style={{ padding: "12px 14px", color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>{issue.caseNo}</td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8", whiteSpace: "nowrap" }}>{issue.date}</td>
                        <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: BC[issue.brand] + "25", color: BC[issue.brand] }}>{issue.brand}</span></td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.productType}</td>
                        <td style={{ padding: "12px 14px" }}><div style={{ fontWeight: 600, color: "#e2e8f0" }}>{issue.tireModel}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.tireSize}</div></td>
                        <td style={{ padding: "12px 14px", color: "#e2e8f0" }}>{issue.issueType}</td>
                        <td style={{ padding: "12px 14px" }}><div style={{ color: "#e2e8f0" }}>{issue.shopName}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.shopTier}</div></td>
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

        {view === "list" && sel && (
          <div className="fu">
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => setSel(null)} style={{ ...S.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← กลับรายการ</button>
              <button onClick={() => exportPDF(sel)} style={{ ...S.btn, background: "#dc2626", color: "#fff", padding: "8px 20px" }}>📄 Export PDF</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ ...S.card, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="logo-icon" style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔧</div>
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
                  <div style={{ color: "#6366f1" }}>{sel.tireWeek}</div>
                </div>
              </div>
              {[
                { title: "ปัญหา", items: [["ประเภทปัญหา", sel.issueType], ["รายละเอียดปัญหา", sel.issueDetail||"-"]] },
                { title: "ร้านค้า", items: [["เลขที่ใบเคลม", sel.claimRefNo||"-"], ["ชื่อร้าน", sel.shopName], ["ประเภทร้าน", sel.shopTier], ["ร้านตัวแทน", sel.distributorName||"-"], ["จังหวัดที่พบปัญหา", sel.province], ["วันที่รับยางเคลม", sel.claimDate||"-"]] },
                { title: "ผู้รายงาน", items: [["ชื่อ", sel.reporterName]] },
              ].map((sec,i) => (
                <div key={i} style={S.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{sec.title}</div>
                  {sec.items.map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2235", fontSize: 14 }}>
                      <span style={{ color: "#64748b" }}>{k}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
              {(sel.images||[]).filter(i => i.url).length > 0 && (
                <div style={S.card}>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12 }}>ภาพถ่าย ({sel.images.filter(i => i.url).length} รูป)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {sel.images.filter(i => i.url).map((img,i) => (
                      <img key={i} src={img.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148", cursor: "pointer" }} onClick={() => window.open(img.url, "_blank")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div style={{ borderTop: "1px solid #2d3148", marginTop: 40, padding: "16px 24px", textAlign: "center", color: "#475569", fontSize: 12 }}>
        &copy; {new Date().getFullYear()} Deestone Co., Ltd. | Tire Quality Tracker | Developed by Apiwich Ruangsrisoragrai &mdash; 2W
      </div>
    </div>
  );
}
