import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://xygvrhzvieulmexyjxuv.supabase.co";
const SUPABASE_KEY = "sb_publishable_wCNv0fp4POlUtncwJrug5g_6dNLyXbU";

const sbHeaders = (extra) => Object.assign({
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
}, extra || {});

const sbFetch = async (method, body) => {
  const url = SUPABASE_URL + "/rest/v1/issues" + (method === "GET" ? "?select=*&order=created_at.desc" : "");
  const res = await fetch(url, {
    method,
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: method === "POST" ? "return=representation" : "" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return method === "DELETE" ? null : res.json();
};

// โหลดรายการแบบเร็ว: ไม่ดึงคอลัมน์ images (รูปภาพ) เพื่อให้เปิดแอพเร็วขึ้น
const LIST_COLUMNS = "id,case_no,date,claim_date,claim_ref_no,claim_type,brand,product_type,tire_model,tire_size,tire_week,issue_types,issue_type,issue_detail,reporter_name,shop_name,shop_tier,distributor_name,province,cancelled,factory_dept,factory_cause,factory_cause_detail,factory_problem_detail,factory_plan,factory_due_date,factory_responsible,factory_closed,factory_updated_at";
const sbFetchList = async () => {
  const url = SUPABASE_URL + "/rest/v1/issues?select=" + LIST_COLUMNS + "&order=created_at.desc";
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Soft delete: ทำเครื่องหมายว่ายกเลิก ไม่ลบออกจากฐานข้อมูล
const sbCancel = async (id) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/issues?id=eq." + id, {
    method: "PATCH",
    headers: sbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ cancelled: true }),
  });
  if (!res.ok) throw new Error(await res.text());
};

// โหลดรูปภาพของเคสเดียว (ใช้ตอนเปิดดูรายละเอียด)
const sbFetchImages = async (id) => {
  const url = SUPABASE_URL + "/rest/v1/issues?id=eq." + id + "&select=images";
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data[0] && data[0].images) || [];
};

// โหลดรูปภาพส่วนโรงงาน (รายละเอียดปัญหา + แผนการแก้ไข)
const sbFetchFactoryImages = async (id) => {
  const url = SUPABASE_URL + "/rest/v1/issues?id=eq." + id + "&select=factory_problem_images,factory_plan_images";
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    factoryProblemImages: (data[0] && data[0].factory_problem_images) || [],
    factoryPlanImages: (data[0] && data[0].factory_plan_images) || [],
  };
};

// บันทึก snapshot ก่อนแก้ไข (สำหรับ version history)
const sbSaveHistory = async (issueId, snapshot, changedBy) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/issues_history", {
    method: "POST",
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ issue_id: issueId, snapshot, changed_by: changedBy }),
  });
  if (!res.ok) throw new Error(await res.text());
};

// ดึง history ของเคส
const sbFetchHistory = async (issueId) => {
  const url = SUPABASE_URL + "/rest/v1/issues_history?issue_id=eq." + issueId + "&order=changed_at.desc&select=*";
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// อัพเดตข้อมูลเคส
const sbUpdate = async (id, payload) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/issues?id=eq." + id, {
    method: "PATCH",
    headers: sbHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
};

const sbDelete = async (id) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/issues?id=eq." + id, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
};

const sbUploadImage = async (dataUrl, fileName) => {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("invalid data url");
  const [, contentType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const path = Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + fileName;
  const res = await fetch(SUPABASE_URL + "/storage/v1/object/tire-images/" + path, {
    method: "POST",
    headers: sbHeaders({ "Content-Type": contentType }),
    body: bytes,
  });
  if (!res.ok) throw new Error(await res.text());
  return SUPABASE_URL + "/storage/v1/object/public/tire-images/" + path;
};

// ---------- constants ----------
const ADMIN_PASS = "Mrlynn702";
const requireAdminPass = (action) => {
  const input = window.prompt("🔒 กรุณาใส่รหัสผ่านหรือติดต่อ Admin เพื่อ" + action);
  return input === ADMIN_PASS;
};
const BRANDS = ["Deestone", "Bluhorse"];
const PRODUCT_TYPES = ["Tire MC T/T", "Tire MC T/L", "Tire BC", "Tube MC", "Tube BC"];
const ISSUE_TYPES_TIRE = ["รั่วหน้ายาง", "รั่วแก้มยาง", "แผลแก้มยาง", "แผลหน้ายาง", "บวมไหล่ยาง", "บวมแก้มยาง", "บวมหน้ายาง", "บวมใต้ท้องยาง", "ลวดคด", "สิ่งแปลกปลอมอยู่ในยาง", "แตกร่องดอกยาง", "ยางส่าย", "ยางไม่กลม", "ยางขึ้นขอบยาก", "ยางสกปรก", "อื่นๆ (ระบุในรายละเอียดปัญหา)"];
const ISSUE_TYPES_TUBE = ["รั่ว", "ระเบิด", "เติมลมไม่เข้า", "มีสิ่งแปลกปลอม", "แผล", "ยางในบาง", "ฐานวาล์วแยกตัว", "วาล์วหลุดแกน", "อื่นๆ (ระบุในช่องรายละเอียดปัญหา)"];
const ALL_ISSUE_TYPES = [...ISSUE_TYPES_TIRE, ...ISSUE_TYPES_TUBE];
const issueTypesFor = (productType) => productType.startsWith("Tube") ? ISSUE_TYPES_TUBE : ISSUE_TYPES_TIRE;
const CLAIM_TYPES = ["New Defective", "Claim"];
const SHOP_TIERS = ["ดิสทริบิวเตอร์", "โฮลเซลล์", "ร้านค้าช่วง", "ร้านช่าง"];
const NEEDS_DIST = ["ร้านค้าช่วง", "ร้านช่าง"];
const PROVINCES = ["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];
const FACTORY_DEPTS = ["DRB", "DSI"];
const FACTORY_CAUSES = ["ขนส่ง", "การผลิต", "จัดเก็บ", "ผู้ใช้งาน", "อื่นๆ"];
const BC = { Deestone: "#e63946", Bluhorse: "#1d4ed8" };

function initForm() {
  return {
    date: new Date().toISOString().split("T")[0],
    claimDate: "", claimRefNo: "", claimType: "New Defective", brand: "Deestone", productType: "Tire MC T/T",
    tireModel: "", tireSize: "", issueTypes: [], issueDetail: "",
    reporterName: "", shopName: "", shopTier: "ดิสทริบิวเตอร์",
    distributorName: "", province: "กรุงเทพมหานคร", tireWeek: "", images: [],
  };
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: hidden; max-width: 100%; }
  input, select, textarea, button { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #6366f1; }
  .rh:hover { background: #1e2235 !important; cursor: pointer; }
  @keyframes fu { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .fu { animation: fu 0.35s ease both; }
  @keyframes si { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast { animation: si 0.3s ease; position: fixed; top: 20px; right: 20px; z-index: 9999; color: #fff; padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; }
  .toast-ok { background: #22c55e; }
  .toast-err { background: #ef4444; }
  .bar-purple { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .bar-orange { background: linear-gradient(90deg, #e63946, #f59e0b); }
  .btn-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; }
  .btn-green { background: linear-gradient(135deg, #22c55e, #16a34a) !important; }
  .loading-overlay { position: fixed; inset: 0; background: #0f1117; display: flex; align-items: center; justify-content: center; z-index: 9999; }

  /* responsive helpers */
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .filter-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .filter-row input, .filter-row select { width: auto; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .list-filter-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-width: 0; }
  .detail-grid > * { min-width: 0; }
  .hide-mobile { display: table-cell; }
  .nav-label-full { display: inline; }
  .nav-label-short { display: none; }
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }
  .status-full { display: inline; }
  .status-short { display: none; }

  @media (max-width: 720px) {
    .wrap { padding: 14px; }
    .stat-grid { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .chart-grid { grid-template-columns: 1fr; gap: 12px; }
    .filter-row { flex-direction: column; width: 100%; }
    .filter-row input, .filter-row select { width: 100% !important; }
    .form-grid { grid-template-columns: 1fr; }
    .list-filter-grid { grid-template-columns: 1fr 1fr; }
    .detail-grid { grid-template-columns: 1fr; }
    .hide-mobile { display: none; }
    .nav-label-full { display: none; }
    .nav-label-short { display: inline; }
    .header-inner { height: 56px !important; }
    .dash-head { flex-direction: column; align-items: stretch !important; }
    h2.page-title { font-size: 19px !important; }
    .stat-value { font-size: 24px !important; }
    .stat-card-pad { padding: 14px !important; }
    .detail-logo { height: 40px !important; }
    .detail-caseno { font-size: 20px !important; }
    .status-full { display: none; }
    .status-short { display: inline; }
  }

  /* ---- การพิมพ์ PDF ในหน้าเดียวกับแอพ ---- */
  #print-area { display: none; }
  @media print {
    @page { size: A4; margin: 12mm; }
    body * { visibility: hidden; }
    #print-area, #print-area * { visibility: visible; }
    #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
    .no-print { display: none !important; }
  }
`;

const S = {
  page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" },
  card: { background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 12, padding: 20, maxWidth: "100%", overflow: "hidden" },
  inp: { background: "#0f1117", border: "1px solid #2d3148", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", width: "100%", fontSize: 14 },
  btn: { cursor: "pointer", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  lbl: { fontSize: 13, color: "#94a3b8", display: "block", marginBottom: 6 },
  hdr: { background: "#1a1d27", borderBottom: "1px solid #2d3148", padding: "0 24px" },
  hdrIn: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 },
  main: { maxWidth: 1200, margin: "0 auto", padding: 24 },
  secTitle: { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  colFull: { gridColumn: "1 / -1" },
};

// ---------- small reusable UI pieces ----------
const Card = ({ title, style, children }) => (
  <div style={{ ...S.card, ...style }}>
    {title && <div style={S.secTitle}>{title}</div>}
    {children}
  </div>
);

const Field = ({ label, required, color, children }) => (
  <div>
    <label style={{ ...S.lbl, color: color || S.lbl.color }}>{label}{required && <span style={{ color: "#ef4444" }}> *</span>}</label>
    {children}
  </div>
);

const TField = (props) => {
  const { label, required, color, style, ...rest } = props;
  return (
    <Field label={label} required={required} color={color}>
      <input style={{ ...S.inp, ...style }} {...rest} />
    </Field>
  );
};

const SField = ({ label, options, ...rest }) => (
  <Field label={label}>
    <select style={S.inp} {...rest}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </Field>
);

const ButtonGroup = ({ value, onChange, options, getColor, full, small }) => (
  <div style={{ display: "flex", gap: small ? 6 : 8 }}>
    {options.map(opt => {
      const active = value === opt;
      const color = (getColor && getColor(opt)) || "#6366f1";
      return (
        <button key={opt} onClick={() => onChange(opt)}
          style={{ ...S.btn, flex: 1, padding: small ? "10px 4px" : 10, fontSize: small ? 12 : 14, background: active ? color : "#0f1117", color: "#fff", border: (small ? "1.5px" : "2px") + " solid " + (active ? color : "#2d3148") }}>
          {opt}
        </button>
      );
    })}
  </div>
);

const Badge = ({ children, bg, color }) => (
  <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color }}>{children}</span>
);

const StatCard = ({ icon, value, label, color }) => (
  <div style={{ ...S.card, borderLeft: "4px solid " + color, ...(icon ? {} : { padding: 20, textAlign: "center" }) }}>
    {icon && <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>}
    <div style={{ fontSize: icon ? 32 : 36, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{label}</div>
  </div>
);

const KVList = ({ title, items }) => (
  <Card>
    <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
    {items.map(([k, v]) => (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e2235", fontSize: 14 }}>
        <span style={{ color: "#64748b", flexShrink: 0 }}>{k}</span>
        <span style={{ color: "#e2e8f0", fontWeight: 500, textAlign: "right", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>{v}</span>
      </div>
    ))}
  </Card>
);

// Donut chart (pure SVG, no library)
const Donut = ({ title, items }) => {
  const total = items.reduce((s, x) => s + x.count, 0);
  const size = 160, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Card title={null}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>{title}</div>
      {total === 0
        ? <div style={{ color: "#475569", textAlign: "center", padding: "30px 0" }}>ยังไม่มีข้อมูล</div>
        : (
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
            <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
              <g transform={"rotate(-90 " + (size / 2) + " " + (size / 2) + ")"}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2d3148" strokeWidth={stroke} />
                {items.filter(x => x.count > 0).map((x, i) => {
                  const frac = x.count / total;
                  const dash = frac * c;
                  const el = (
                    <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={x.color} strokeWidth={stroke}
                      strokeDasharray={dash + " " + (c - dash)} strokeDashoffset={-offset} />
                  );
                  offset += dash;
                  return el;
                })}
              </g>
              <text x="50%" y="48%" textAnchor="middle" fill="#f1f5f9" fontSize="26" fontWeight="700">{total}</text>
              <text x="50%" y="62%" textAnchor="middle" fill="#64748b" fontSize="11">รายการ</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(x => (
                <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: x.color, display: "inline-block" }} />
                  <span style={{ color: "#94a3b8", minWidth: 90 }}>{x.label}</span>
                  <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{x.count}</span>
                  <span style={{ color: "#64748b", fontSize: 11 }}>({total ? Math.round(x.count / total * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
    </Card>
  );
};

// Vertical bar chart (pure SVG)
const BarChart = ({ title, items, color }) => {
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <Card title={null}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>{title}</div>
      {items.every(i => i.count === 0)
        ? <div style={{ color: "#475569", textAlign: "center", padding: "30px 0" }}>ยังไม่มีข้อมูล</div>
        : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, padding: "0 4px" }}>
            {items.map((it, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{it.count}</div>
                <div style={{ width: "100%", maxWidth: 46, height: (it.count / max * 110) + "px", minHeight: it.count > 0 ? 4 : 0, background: it.color || color, borderRadius: "6px 6px 0 0", transition: "height 0.4s ease" }} />
                <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.2 }}>{it.label}</div>
              </div>
            ))}
          </div>
        )}
    </Card>
  );
};

// ---------- PDF document (render ในหน้าเดียวกับแอพ แล้วใช้ window.print) ----------
// ใช้ origin เดียวกับแอพ รูปจึงโหลดได้ปกติ ไม่ติด CORS
const PD = {
  page: { fontFamily: "sans-serif", color: "#1e293b", fontSize: 14, padding: 24, background: "#fff" },
  hdr: { background: "#1a1d27", color: "#fff", padding: "20px 26px", borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 18 },
  cols: { display: "flex", gap: 18 },
  col: { flex: 1, minWidth: 0 },
  sec: { marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" },
  sech: { background: "#f8fafc", padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e2e8f0" },
  td1: { padding: "8px 14px", fontSize: 13, color: "#64748b", width: "40%", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  td2: { padding: "8px 14px", fontSize: 13, fontWeight: 500, borderBottom: "1px solid #f1f5f9", wordBreak: "break-word" },
  imgs: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: 12 },
  img: { width: "100%", height: 150, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" },
  ftr: { marginTop: 18, paddingTop: 18, textAlign: "center", fontSize: 11, color: "#94a3b8", borderTop: "1px solid #e2e8f0" },
};

const PDSection = ({ title, rows }) => (
  <div style={PD.sec}>
    <div style={PD.sech}>{title}</div>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={PD.td1}>{k}</td>
            <td style={PD.td2}>{v || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PrintDoc = ({ issue }) => {
  if (!issue) return null;
  const imgs = (issue.images || []).filter(i => i.url).slice(0, 5);
  const hasFactory = issue.factoryDept || issue.factoryCause || issue.factoryProblemDetail || issue.factoryPlan || issue.factoryClosed;
  return (
    <div id="print-area">
      <div style={PD.page}>
        <div style={PD.hdr}>
          <img src="/deestone-logo.png" alt="Deestone" style={{ height: 46, width: "auto", background: "#fff", borderRadius: 6, padding: "5px 10px" }} />
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>รายงานปัญหาคุณภาพยาง</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>{issue.caseNo}</div>
          </div>
        </div>
        <div style={PD.cols}>
          <div style={PD.col}>
            <PDSection title="ข้อมูลพื้นฐาน" rows={[
              ["แบรนด์", issue.brand], ["ประเภทสินค้า", issue.productType], ["วันที่รับยางเคลม", issue.claimDate],
              ["รุ่นยาง", issue.tireModel], ["ขนาดยาง", issue.tireSize], ["สัปดาห์ยาง / Serial", issue.tireWeek],
            ]} />
            <PDSection title="ข้อมูลปัญหา" rows={[
              ["ประเภทปัญหา", (issue.issueTypes || []).join(", ")], ["รายละเอียดปัญหา", issue.issueDetail],
            ]} />
          </div>
          <div style={PD.col}>
            <PDSection title="ข้อมูลร้านค้า" rows={[
              ["เลขที่ใบเคลม", issue.claimRefNo], ["ประเภทยางเคลม", issue.claimType], ["ชื่อร้านค้า", issue.shopName],
              ["ประเภทร้าน", issue.shopTier], ["ร้านตัวแทนที่รับมา", issue.distributorName],
              ["จังหวัดที่พบปัญหา", issue.province], ["วันที่พบปัญหา", issue.date], ["ผู้รายงาน", issue.reporterName],
            ]} />
          </div>
        </div>
        {imgs.length > 0 && (
          <div style={PD.sec}>
            <div style={PD.sech}>ภาพถ่าย</div>
            <div style={PD.imgs}>
              {imgs.map((img, i) => <img key={i} src={img.url} alt="" style={PD.img} />)}
            </div>
          </div>
        )}
        <div style={PD.ftr}>
          Tire Quality Tracker &mdash; Deestone &amp; Bluhorse | เลขเคส: {issue.caseNo}<br />
          &copy; {new Date().getFullYear()} Deestone Co., Ltd. | Developed by Apiwich Ruangsrisoragrai &mdash; 2W
        </div>
      </div>

      {hasFactory && (
        <div style={{ ...PD.page, pageBreakBefore: "always" }}>
          <div style={PD.hdr}>
            <img src="/deestone-logo.png" alt="Deestone" style={{ height: 46, width: "auto", background: "#fff", borderRadius: 6, padding: "5px 10px" }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>🏭 ข้อมูลโรงงาน &mdash; เคส {issue.caseNo}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>{issue.caseNo}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: issue.factoryClosed ? "#4ade80" : "#67e8f9" }}>
                {issue.factoryClosed ? "✅ ปิดเคสแล้ว" : (issue.factoryDept ? "🔧 " + issue.factoryDept + " กำลังดำเนินการ" : "")}
              </div>
            </div>
          </div>
          <PDSection title="ข้อมูลการดำเนินการของโรงงาน" rows={[
            ["หน่วยงานที่รับผิดชอบ", issue.factoryDept], ["ผู้รับผิดชอบ", issue.factoryResponsible],
            ["ต้นเหตุของปัญหา", (issue.factoryCause || "-") + (issue.factoryCauseDetail ? " (" + issue.factoryCauseDetail + ")" : "")],
            ["กำหนดแก้ไขแล้วเสร็จ", issue.factoryDueDate],
            ["บันทึกล่าสุดเมื่อ", issue.factoryUpdatedAt ? new Date(issue.factoryUpdatedAt).toLocaleString("th-TH") : "-"],
            ["รายละเอียดปัญหาที่พบ", issue.factoryProblemDetail],
            ["แผนการแก้ไข", issue.factoryPlan],
          ]} />
          {((issue.factoryProblemImages || []).length > 0 || (issue.factoryPlanImages || []).length > 0) && (
            <div style={PD.sec}>
              <div style={PD.sech}>ภาพถ่ายประกอบ (โรงงาน)</div>
              <div style={PD.imgs}>
                {[...(issue.factoryProblemImages || []), ...(issue.factoryPlanImages || [])].filter(im => im.url).slice(0, 8).map((img, i) => (
                  <img key={i} src={img.url} alt="" style={PD.img} />
                ))}
              </div>
            </div>
          )}
          <div style={PD.ftr}>
            Tire Quality Tracker &mdash; Deestone &amp; Bluhorse | เลขเคส: {issue.caseNo}<br />
            &copy; {new Date().getFullYear()} Deestone Co., Ltd. | Developed by Apiwich Ruangsrisoragrai &mdash; 2W
          </div>
        </div>
      )}
    </div>
  );
};

// บีบอัดรูปก่อนเก็บ: ย่อด้านยาวสุดไม่เกิน 1600px และลดคุณภาพ JPEG เหลือ 80%
// ทำให้ไฟล์เล็กลงมาก (เก็บได้หลายเคสขึ้น) แต่ยังคมชัดพอสำหรับตรวจสอบ/ขยายดู
const compressImage = (file, maxDim, quality) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// ---------- App ----------
export default function App() {
  const [view, setView] = useState("form");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initForm());
  const [previewMode, setPreviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [fBrand, setFBrand] = useState("ทั้งหมด");
  const [fIssue, setFIssue] = useState("ทั้งหมด");
  const [fProd, setFProd] = useState("ทั้งหมด");
  const [fMonth, setFMonth] = useState("ทั้งปี");
  const [sel, setSel] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [printIssue, setPrintIssue] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [factoryEditMode, setFactoryEditMode] = useState(false);
  const [factoryForm, setFactoryForm] = useState(null);
  const [showEditChoice, setShowEditChoice] = useState(false);
  const [toast, setToast] = useState(null);
  const imgRef = useRef();

  const showToast = (msg, type) => {
    setToast({ msg, type: type || "ok" });
    setTimeout(() => setToast(null), 3000);
  };

  const setF = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    sbFetchList().then(data => {
      const mapped = data.map(r => ({
        id: r.id, caseNo: r.case_no, date: r.date, claimDate: r.claim_date,
        claimRefNo: r.claim_ref_no, claimType: r.claim_type || "New Defective",
        brand: r.brand, productType: r.product_type,
        tireModel: r.tire_model, tireSize: r.tire_size, tireWeek: r.tire_week,
        issueTypes: r.issue_types || (r.issue_type ? [r.issue_type] : []), issueDetail: r.issue_detail,
        reporterName: r.reporter_name, shopName: r.shop_name, shopTier: r.shop_tier,
        distributorName: r.distributor_name, province: r.province, cancelled: r.cancelled || false,
        factoryDept: r.factory_dept || "", factoryCause: r.factory_cause || "", factoryCauseDetail: r.factory_cause_detail || "",
        factoryProblemDetail: r.factory_problem_detail || "", factoryPlan: r.factory_plan || "",
        factoryDueDate: r.factory_due_date || "", factoryResponsible: r.factory_responsible || "",
        factoryClosed: r.factory_closed || false, factoryUpdatedAt: r.factory_updated_at || null,
        factoryProblemImages: [], factoryPlanImages: [], factoryImagesLoaded: false,
        images: [], imagesLoaded: false,
      }));
      setIssues(mapped);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const addFiles = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(async (f) => ({
      name: f.name.replace(/\.\w+$/, "") + ".jpg",
      url: await compressImage(f, 1600, 0.8),
    }))).then(res => setForm(p => ({ ...p, images: [...p.images, ...res] })));
  };

  const validateForm = () => {
    if (!form.date) return showToast("กรุณากรอกวันที่พบปัญหา", "err"), false;
    if (!form.claimDate) return showToast("กรุณากรอกวันที่รับยางเคลม", "err"), false;
    if (!form.claimRefNo) return showToast("กรุณากรอกเลขที่ใบเคลม", "err"), false;
    if (!form.tireModel) return showToast("กรุณากรอกรุ่นยาง", "err"), false;
    if (!form.tireSize) return showToast("กรุณากรอกขนาดยาง", "err"), false;
    if (!form.tireWeek) return showToast("กรุณากรอกสัปดาห์ยาง / Serial", "err"), false;
    if (form.issueTypes.length === 0) return showToast("กรุณาเลือกประเภทปัญหาอย่างน้อย 1 ข้อ", "err"), false;
    if (!form.shopName) return showToast("กรุณากรอกชื่อร้านค้า", "err"), false;
    if (NEEDS_DIST.includes(form.shopTier) && !form.distributorName) return showToast("กรุณากรอกร้านตัวแทนที่รับมา", "err"), false;
    if (!form.reporterName) return showToast("กรุณากรอกผู้รายงาน", "err"), false;
    return true;
  };

  const toggleIssueType = (t) => setForm(p => ({
    ...p,
    issueTypes: p.issueTypes.includes(t) ? p.issueTypes.filter(x => x !== t) : [...p.issueTypes, t],
  }));

  // เปลี่ยนประเภทสินค้า → ล้างประเภทปัญหาที่ไม่อยู่ในกลุ่มใหม่
  const onProductChange = (e) => {
    const productType = e.target.value;
    const valid = issueTypesFor(productType);
    setForm(p => ({ ...p, productType, issueTypes: p.issueTypes.filter(t => valid.includes(t)) }));
  };

  const submit = async () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    // นับเลขเคสใหม่เป็น 001 ทุกต้นเดือน: หาจำนวนเคสที่มีเลขเคสขึ้นต้นด้วยปี+เดือนเดียวกัน (C + YYMM)
    const monthPrefix = "C" + yy + mm;
    const countThisMonth = issues.filter(i => (i.caseNo || "").startsWith(monthPrefix)).length;
    const caseNo = monthPrefix + dd + String(countThisMonth + 1).padStart(3, "0");
    showToast("กำลังอัปโหลดรูป...");
    try {
      const uploadedImages = await Promise.all(form.images.map(async (img) => {
        if (img.url && img.url.startsWith("data:")) {
          return { name: img.name, url: await sbUploadImage(img.url, img.name) };
        }
        return img;
      }));
      const payload = {
        case_no: caseNo, date: form.date, claim_date: form.claimDate,
        claim_ref_no: form.claimRefNo, claim_type: form.claimType, brand: form.brand, product_type: form.productType,
        tire_model: form.tireModel, tire_size: form.tireSize, tire_week: form.tireWeek,
        issue_types: form.issueTypes, issue_detail: form.issueDetail,
        reporter_name: form.reporterName, shop_name: form.shopName, shop_tier: form.shopTier,
        distributor_name: form.distributorName, province: form.province,
        images: uploadedImages,
      };
      const [saved] = await sbFetch("POST", payload);
      setIssues(p => [{ ...form, id: saved.id, caseNo, images: uploadedImages }, ...p]);
      setForm(initForm());
      setPreviewMode(false);
      showToast("บันทึกสำเร็จ");
      setView("list");
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const deleteIssue = async (issue) => {
    if (!requireAdminPass("ยกเลิกข้อมูล")) return showToast("รหัสผ่านไม่ถูกต้อง", "err");
    if (!window.confirm("ยืนยันยกเลิกเคส " + issue.caseNo + " ? เคสจะถูกขีดฆ่าแต่ยังเก็บเลขเคสไว้")) return;
    try {
      await sbCancel(issue.id);
      setIssues(p => p.map(i => i.id === issue.id ? { ...i, cancelled: true } : i));
      setSel(null);
      showToast("ยกเลิกเคสสำเร็จ");
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "err");
    }
  };

  const deleteMany = async (ids) => {
    if (ids.length === 0) return;
    if (!requireAdminPass("ยกเลิกข้อมูล")) return showToast("รหัสผ่านไม่ถูกต้อง", "err");
    if (!window.confirm("ยืนยันยกเลิก " + ids.length + " รายการ? เคสจะถูกขีดฆ่าแต่ยังเก็บเลขเคสไว้")) return;
    showToast("กำลังยกเลิกข้อมูล...");
    const results = await Promise.allSettled(ids.map(id => sbCancel(id)));
    const okIds = ids.filter((id, i) => results[i].status === "fulfilled");
    setIssues(p => p.map(i => okIds.includes(i.id) ? { ...i, cancelled: true } : i));
    setSelectedIds(new Set());
    if (okIds.length === ids.length) showToast("ยกเลิก " + okIds.length + " รายการสำเร็จ");
    else showToast("ยกเลิกสำเร็จ " + okIds.length + " จาก " + ids.length + " รายการ", okIds.length === 0 ? "err" : "ok");
  };

  const filtered = useMemo(() => issues.filter(i => {
    if (i.cancelled) return false;
    const q = search.toLowerCase();
    return (!q || [i.tireModel, i.shopName, i.reporterName, i.province, (i.issueTypes || []).join(" ")].some(v => (v || "").toLowerCase().includes(q)))
      && (fBrand === "ทั้งหมด" || i.brand === fBrand)
      && (fIssue === "ทั้งหมด" || (i.issueTypes || []).includes(fIssue))
      && (fProd === "ทั้งหมด" || i.productType === fProd)
      && (fMonth === "ทั้งปี" || (i.date || "").slice(0, 7) === fMonth);
  }), [issues, search, fBrand, fIssue, fProd, fMonth]);

  // รายการทั้งหมดสำหรับหน้ารายการ (รวมที่ยกเลิกแล้ว แต่ขีดฆ่า)
  const listItems = useMemo(() => issues.filter(i => {
    const q = search.toLowerCase();
    return (!q || [i.tireModel, i.shopName, i.reporterName, i.province, (i.issueTypes || []).join(" ")].some(v => (v || "").toLowerCase().includes(q)))
      && (fBrand === "ทั้งหมด" || i.brand === fBrand)
      && (fIssue === "ทั้งหมด" || (i.issueTypes || []).includes(fIssue))
      && (fProd === "ทั้งหมด" || i.productType === fProd)
      && (fMonth === "ทั้งปี" || (i.date || "").slice(0, 7) === fMonth);
  }), [issues, search, fBrand, fIssue, fProd, fMonth]);

  // เดือนที่มีข้อมูล (สำหรับ dropdown) — รูปแบบ YYYY-MM
  const monthOptions = useMemo(() => {
    const set = [...new Set(issues.map(i => (i.date || "").slice(0, 7)).filter(Boolean))];
    return set.sort().reverse();
  }, [issues]);

  const monthLabel = (ym) => {
    if (ym === "ทั้งปี") return "ทั้งปี";
    const [y, m] = ym.split("-");
    const names = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return names[parseInt(m, 10)] + " " + y;
  };

  const exportCSV = async () => {
    if (!requireAdminPass("ดาวน์โหลดไฟล์ Excel")) return showToast("รหัสผ่านไม่ถูกต้อง", "err");
    showToast("กำลังเตรียมไฟล์...");
    // โหลดรูปของเคสที่ยังไม่เคยโหลด (สำหรับใส่ลิงก์ใน Excel)
    const withImages = await Promise.all(filtered.map(async (i) => {
      if (i.imagesLoaded) return i;
      try {
        const images = await sbFetchImages(i.id);
        return { ...i, images, imagesLoaded: true };
      } catch {
        return i;
      }
    }));
    setIssues(prev => prev.map(p => {
      const found = withImages.find(w => w.id === p.id);
      return found ? { ...p, images: found.images, imagesLoaded: true } : p;
    }));

    // รวมเคสที่ยกเลิกแล้วด้วย (แสดงแค่เลขเคส + สถานะ)
    const cancelledItems = issues.filter(i => i.cancelled);

    // เรียงเก่า -> ใหม่ รวมทั้งปกติและยกเลิก
    const ordered = [...withImages, ...cancelledItems].sort((a, b) => (a.caseNo || "").localeCompare(b.caseNo || ""));
    const imgUrls = (i) => (i.images || []).filter(im => im.url && !im.url.startsWith("data:")).map(im => im.url);
    const maxImgs = Math.max(0, ...withImages.map(i => imgUrls(i).length));
    const imgHeaders = Array.from({ length: maxImgs }, (_, k) => "รูปที่ " + (k + 1));
    const headers = ["เลขเคส","สถานะ","เลขที่ใบเคลม","ประเภทยางเคลม","วันที่","วันที่รับเคลม","แบรนด์","ประเภทสินค้า","รุ่นยาง","ขนาด","สัปดาห์ยาง/Serial","ประเภทปัญหา","รายละเอียดปัญหา","ผู้รายงาน","ร้านค้า","ประเภทร้าน","ร้านตัวแทน","จังหวัด", ...imgHeaders];
    const imgColStart = headers.length - maxImgs; // index (0-based) ของคอลัมน์รูปแรก

    const rows = ordered.map(i => {
      if (i.cancelled) {
        return [i.caseNo, "ยกเลิก", ...Array(headers.length - 2).fill("")];
      }
      const urls = imgUrls(i);
      const imgCols = Array.from({ length: maxImgs }, (_, k) => urls[k] || "");
      return [
        i.caseNo, "ปกติ", i.claimRefNo, i.claimType, i.date, i.claimDate, i.brand, i.productType,
        i.tireModel, i.tireSize, i.tireWeek, (i.issueTypes || []).join(", "), i.issueDetail, i.reporterName,
        i.shopName, i.shopTier, i.distributorName, i.province, ...imgCols,
      ];
    });

    // สร้างไฟล์ .xlsx ด้วย SheetJS แล้วใส่ hyperlink ให้คอลัมน์รูปภาพ กดแล้วเปิดรูปได้ทันที
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    rows.forEach((row, rIdx) => {
      for (let c = imgColStart; c < headers.length; c++) {
        const url = row[c];
        if (url) {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx + 1, c });
          ws[cellRef].l = { Target: url, Tooltip: "เปิดดูรูปภาพ" };
          ws[cellRef].v = "🔗 เปิดดูรูป";
          ws[cellRef].t = "s";
        }
      }
    });
    ws["!cols"] = headers.map((h, idx) => ({ wch: idx < imgColStart ? 16 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tire Quality");
    XLSX.writeFile(wb, "tire_quality.xlsx");
    showToast("Export Excel สำเร็จ");
  };

  const exportPDF = async (issue) => {
    showToast("กำลังเตรียมเอกสาร...");
    let withImages = issue;
    try {
      const images = await sbFetchImages(issue.id);
      withImages = { ...withImages, images, imagesLoaded: true };
    } catch {}
    try {
      const { factoryProblemImages, factoryPlanImages } = await sbFetchFactoryImages(issue.id);
      withImages = { ...withImages, factoryProblemImages, factoryPlanImages, factoryImagesLoaded: true };
    } catch {}
    setPrintIssue(withImages);
    // รอให้ React render #print-area และรูปโหลดเสร็จก่อนสั่งพิมพ์
    setTimeout(() => {
      const imgs = document.querySelectorAll("#print-area img");
      const waitAll = Array.from(imgs).map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = r; im.onerror = r; }));
      Promise.all(waitAll).then(() => {
        window.print();
      });
    }, 100);
  };

  const total = issues.length;
  const ptCounts = PRODUCT_TYPES.map(t => ({ t, c: filtered.filter(i => i.productType === t).length }));
  const pvCounts = [...new Set(filtered.map(i => i.province))].map(p => ({ p, c: filtered.filter(i => i.province === p).length })).sort((a, b) => b.c - a.c).slice(0, 5);
  const needsDist = NEEDS_DIST.includes(form.shopTier);
  const hasFilters = search || fBrand !== "ทั้งหมด" || fIssue !== "ทั้งหมด" || fProd !== "ทั้งหมด" || fMonth !== "ทั้งปี";

  // นับจำนวนแต่ละประเภทปัญหา (Top 5) สำหรับกราฟ
  const issueTypeCounts = useMemo(() => {
    const counts = {};
    filtered.forEach(i => (i.issueTypes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filtered]);

  const navGo = (v) => { setView(v); setSel(null); setPreviewMode(false); setSelectedIds(new Set()); };

  const openDetail = (issue) => {
    setSel(issue);
    setEditMode(false);
    setShowHistory(false);
    setFactoryEditMode(false);
    if (!issue.imagesLoaded) {
      sbFetchImages(issue.id).then(images => {
        setSel(s => (s && s.id === issue.id) ? { ...s, images, imagesLoaded: true } : s);
        setIssues(p => p.map(i => i.id === issue.id ? { ...i, images, imagesLoaded: true } : i));
      }).catch(() => {});
    }
    if (!issue.factoryImagesLoaded) {
      sbFetchFactoryImages(issue.id).then(({ factoryProblemImages, factoryPlanImages }) => {
        setSel(s => (s && s.id === issue.id) ? { ...s, factoryProblemImages, factoryPlanImages, factoryImagesLoaded: true } : s);
        setIssues(p => p.map(i => i.id === issue.id ? { ...i, factoryProblemImages, factoryPlanImages, factoryImagesLoaded: true } : i));
      }).catch(() => {});
    }
  };

  const startEdit = () => {
    setEditForm({
      date: sel.date || "", claimDate: sel.claimDate || "", claimRefNo: sel.claimRefNo || "",
      claimType: sel.claimType || "New Defective", brand: sel.brand || "Deestone",
      productType: sel.productType || "Tire MC T/T", tireModel: sel.tireModel || "",
      tireSize: sel.tireSize || "", tireWeek: sel.tireWeek || "",
      issueTypes: sel.issueTypes || [], issueDetail: sel.issueDetail || "",
      reporterName: sel.reporterName || "", shopName: sel.shopName || "",
      shopTier: sel.shopTier || "ดิสทริบิวเตอร์", distributorName: sel.distributorName || "",
      province: sel.province || "กรุงเทพมหานคร",
    });
    setEditMode(true);
    setShowHistory(false);
  };

  const setEF = (key) => (e) => setEditForm(p => ({ ...p, [key]: e.target.value }));
  const toggleEditIssueType = (t) => setEditForm(p => ({
    ...p,
    issueTypes: p.issueTypes.includes(t) ? p.issueTypes.filter(x => x !== t) : [...p.issueTypes, t],
  }));
  const onEditProductChange = (e) => {
    const productType = e.target.value;
    const valid = issueTypesFor(productType);
    setEditForm(p => ({ ...p, productType, issueTypes: p.issueTypes.filter(t => valid.includes(t)) }));
  };

  const saveEdit = async () => {
    if (!editForm.tireModel) return showToast("กรุณากรอกรุ่นยาง", "err");
    if (editForm.issueTypes.length === 0) return showToast("กรุณาเลือกประเภทปัญหา", "err");
    const reporter = editForm.reporterName || sel.reporterName;
    try {
      // บันทึก snapshot ก่อนแก้ไข
      const snapshot = { ...sel };
      delete snapshot.images;
      delete snapshot.imagesLoaded;
      await sbSaveHistory(sel.id, snapshot, reporter);
      // อัพเดตข้อมูลใหม่
      const payload = {
        date: editForm.date, claim_date: editForm.claimDate, claim_ref_no: editForm.claimRefNo,
        claim_type: editForm.claimType, brand: editForm.brand, product_type: editForm.productType,
        tire_model: editForm.tireModel, tire_size: editForm.tireSize, tire_week: editForm.tireWeek,
        issue_types: editForm.issueTypes, issue_detail: editForm.issueDetail,
        reporter_name: editForm.reporterName, shop_name: editForm.shopName,
        shop_tier: editForm.shopTier, distributor_name: editForm.distributorName,
        province: editForm.province,
      };
      await sbUpdate(sel.id, payload);
      const updated = {
        ...sel, date: editForm.date, claimDate: editForm.claimDate, claimRefNo: editForm.claimRefNo,
        claimType: editForm.claimType, brand: editForm.brand, productType: editForm.productType,
        tireModel: editForm.tireModel, tireSize: editForm.tireSize, tireWeek: editForm.tireWeek,
        issueTypes: editForm.issueTypes, issueDetail: editForm.issueDetail,
        reporterName: editForm.reporterName, shopName: editForm.shopName,
        shopTier: editForm.shopTier, distributorName: editForm.distributorName,
        province: editForm.province,
      };
      setSel(updated);
      setIssues(p => p.map(i => i.id === sel.id ? updated : i));
      setEditMode(false);
      showToast("แก้ไขข้อมูลสำเร็จ");
    } catch {
      showToast("แก้ไขไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    try {
      const data = await sbFetchHistory(sel.id);
      setHistoryData(data);
      setShowHistory(true);
    } catch {
      showToast("โหลดประวัติไม่สำเร็จ", "err");
    }
  };

  // ---- ข้อมูลโรงงาน ----
  const startFactoryEdit = () => {
    setFactoryForm({
      factoryDept: sel.factoryDept || "", factoryCause: sel.factoryCause || "", factoryCauseDetail: sel.factoryCauseDetail || "",
      factoryProblemDetail: sel.factoryProblemDetail || "", factoryProblemImages: sel.factoryProblemImages || [],
      factoryPlan: sel.factoryPlan || "", factoryPlanImages: sel.factoryPlanImages || [],
      factoryDueDate: sel.factoryDueDate || "", factoryResponsible: sel.factoryResponsible || "",
      factoryClosed: sel.factoryClosed || false,
    });
    setFactoryEditMode(true);
    setEditMode(false);
    setShowHistory(false);
  };

  const setFF = (key) => (e) => setFactoryForm(p => ({ ...p, [key]: e.target.value }));

  const addFactoryFiles = (key) => (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(async (f) => ({
      name: f.name.replace(/\.\w+$/, "") + ".jpg",
      url: await compressImage(f, 1600, 0.8),
    }))).then(res => setFactoryForm(p => ({ ...p, [key]: [...p[key], ...res] })));
  };

  const removeFactoryImage = (key, idx) => setFactoryForm(p => ({ ...p, [key]: p[key].filter((_, j) => j !== idx) }));

  const saveFactoryEdit = async () => {
    showToast("กำลังอัปโหลดรูป...");
    try {
      const uploadImgs = async (list) => Promise.all(list.map(async (img) => {
        if (img.url && img.url.startsWith("data:")) return { name: img.name, url: await sbUploadImage(img.url, img.name) };
        return img;
      }));
      const problemImages = await uploadImgs(factoryForm.factoryProblemImages);
      const planImages = await uploadImgs(factoryForm.factoryPlanImages);

      // บันทึก snapshot ก่อนแก้ไข (สำหรับประวัติ)
      const snapshot = { ...sel };
      delete snapshot.images;
      delete snapshot.imagesLoaded;
      delete snapshot.factoryProblemImages;
      delete snapshot.factoryPlanImages;
      delete snapshot.factoryImagesLoaded;
      await sbSaveHistory(sel.id, snapshot, factoryForm.factoryResponsible || sel.reporterName);

      const now = new Date().toISOString();
      const payload = {
        factory_dept: factoryForm.factoryDept, factory_cause: factoryForm.factoryCause,
        factory_cause_detail: factoryForm.factoryCauseDetail, factory_problem_detail: factoryForm.factoryProblemDetail,
        factory_problem_images: problemImages, factory_plan: factoryForm.factoryPlan,
        factory_plan_images: planImages, factory_due_date: factoryForm.factoryDueDate || null,
        factory_responsible: factoryForm.factoryResponsible, factory_closed: factoryForm.factoryClosed,
        factory_updated_at: now,
      };
      await sbUpdate(sel.id, payload);
      const updated = {
        ...sel, factoryDept: factoryForm.factoryDept, factoryCause: factoryForm.factoryCause,
        factoryCauseDetail: factoryForm.factoryCauseDetail, factoryProblemDetail: factoryForm.factoryProblemDetail,
        factoryProblemImages: problemImages, factoryPlan: factoryForm.factoryPlan,
        factoryPlanImages: planImages, factoryDueDate: factoryForm.factoryDueDate,
        factoryResponsible: factoryForm.factoryResponsible, factoryClosed: factoryForm.factoryClosed,
        factoryUpdatedAt: now, factoryImagesLoaded: true,
      };
      setSel(updated);
      setIssues(p => p.map(i => i.id === sel.id ? updated : i));
      setFactoryEditMode(false);
      showToast("บันทึกข้อมูลโรงงานสำเร็จ");
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  // ข้อความสถานะสำหรับแสดงในตารางรายการ
  const factoryStatusLabel = (issue) => {
    if (!issue.factoryDept && !issue.factoryClosed) return null;
    if (issue.factoryClosed) return "✅ ปิดเคสแล้ว";
    if (issue.factoryDept) return "🔧 " + issue.factoryDept + " รับยางแล้ว กำลังดำเนินการแก้ไข";
    return null;
  };

  const clearFilters = () => { setSearch(""); setFBrand("ทั้งหมด"); setFIssue("ทั้งหมด"); setFProd("ทั้งหมด"); setFMonth("ทั้งปี"); };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <PrintDoc issue={printIssue} />

      {loading && (
        <div className="loading-overlay">
          <div style={{ textAlign: "center", color: "#94a3b8" }}>
            <img src="/deestone-logo.png" alt="Deestone" style={{ width: 160, marginBottom: 16 }} />
            <div style={{ fontSize: 16 }}>กำลังโหลดข้อมูล...</div>
          </div>
        </div>
      )}

      {toast && <div className={"toast toast-" + toast.type}>{toast.msg}</div>}

      <div style={S.hdr}>
        <div className="header-inner" style={S.hdrIn}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/deestone-logo.png" alt="Deestone" style={{ height: 30, width: "auto" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>Tire Quality Tracker</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Deestone &amp; Bluhorse</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["form", "➕", "บันทึก"], ["dashboard", "📊", "Dashboard"], ["list", "📋", "รายการ"]].map(([v, icon, l]) => (
              <button key={v} onClick={() => navGo(v)}
                style={{ ...S.btn, padding: "9px 14px", background: view === v ? "#6366f1" : "transparent", color: view === v ? "#fff" : "#94a3b8", border: view === v ? "none" : "1px solid #2d3148" }}>
                <span className="nav-label-short">{icon}</span>
                <span className="nav-label-full">{icon} {l}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap">

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div className="fu">
            <div className="dash-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 }}>
              <div>
                <h2 className="page-title" style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>ภาพรวมปัญหาคุณภาพยาง</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ข้อมูลทั้งหมด {total} รายการ</p>
              </div>
              <div className="filter-row">
                <input style={{ ...S.inp, width: 180 }} placeholder="🔍 ค้นหา รุ่น, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...S.inp, width: 140 }} value={fMonth} onChange={e => setFMonth(e.target.value)}>
                  <option value="ทั้งปี">📅 ทั้งปี</option>
                  {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <select style={{ ...S.inp, width: 130 }} value={fBrand} onChange={e => setFBrand(e.target.value)}>
                  <option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
                <select style={{ ...S.inp, width: 150 }} value={fIssue} onChange={e => setFIssue(e.target.value)}>
                  <option>ทั้งหมด</option>{ALL_ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select style={{ ...S.inp, width: 140 }} value={fProd} onChange={e => setFProd(e.target.value)}>
                  <option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {hasFilters && <button onClick={clearFilters} style={{ ...S.btn, background: "#334155", color: "#94a3b8", padding: "10px 14px" }}>ล้าง</button>}
              </div>
            </div>

            <div className="stat-grid">
              <StatCard icon="📌" value={filtered.length} label="ทั้งหมด" color="#6366f1" />
              <StatCard icon="🔴" value={filtered.filter(i => i.brand === "Deestone").length} label="Deestone" color="#e63946" />
              <StatCard icon="🔵" value={filtered.filter(i => i.brand === "Bluhorse").length} label="Bluhorse" color="#1d4ed8" />
            </div>

            <div className="chart-grid">
              {/* Donut: แบรนด์ */}
              <Donut title="แบ่งตามแบรนด์" items={[
                { label: "Deestone", color: "#e63946", count: filtered.filter(i => i.brand === "Deestone").length },
                { label: "Bluhorse", color: "#1d4ed8", count: filtered.filter(i => i.brand === "Bluhorse").length },
              ]} />

              {/* Donut: New Defective / Claim */}
              <Donut title="แบ่งตามประเภทยางเคลม" items={[
                { label: "New Defective", color: "#22c55e", count: filtered.filter(i => (i.claimType || "New Defective") === "New Defective").length },
                { label: "Claim", color: "#f59e0b", count: filtered.filter(i => i.claimType === "Claim").length },
              ]} />

              {/* Bar: ประเภทปัญหา (Top 8) */}
              <BarChart title="ประเภทปัญหาที่พบมากสุด (Top 5)" color="#6366f1" items={issueTypeCounts.map((x, i) => ({
                label: x.label.length > 8 ? x.label.slice(0, 8) + "…" : x.label, color: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444", "#64748b"][i % 5],
                count: x.count,
              }))} />

              {/* Donut: Tire/Tube */}
              <Donut title="แบ่งตามยาง Tire / Tube" items={[
                { label: "Tire", color: "#6366f1", count: filtered.filter(i => i.productType.startsWith("Tire")).length },
                { label: "Tube", color: "#f59e0b", count: filtered.filter(i => i.productType.startsWith("Tube")).length },
              ]} />

              {/* จังหวัด Top 5 - horizontal bars */}
              <Card title={null}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>จังหวัดที่พบปัญหาสูงสุด (Top 5)</div>
                {pvCounts.length === 0 ? <div style={{ color: "#475569", textAlign: "center", padding: "20px 0" }}>ยังไม่มีข้อมูล</div>
                  : pvCounts.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2d3148", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 13 }}>
                          <span>{p.p}</span><span style={{ fontWeight: 700 }}>{p.c}</span>
                        </div>
                        <div style={{ height: 6, background: "#2d3148", borderRadius: 3 }}>
                          <div className="bar-orange" style={{ height: "100%", width: (p.c / pvCounts[0].c * 100) + "%", borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
              </Card>

              {/* ประเภทสินค้า - list */}
              <Card title={null}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#f1f5f9" }}>ประเภทสินค้า</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ptCounts.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f1117", borderRadius: 8, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{p.t}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: p.c > 0 ? "#6366f1" : "#475569" }}>{p.c}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* FORM */}
        {view === "form" && !previewMode && (
          <div className="fu" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>บันทึกปัญหาคุณภาพ</h2>
              <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>กรอกข้อมูลให้ครบ * = จำเป็น</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <Card title="ข้อมูลพื้นฐาน">
                <div className="form-grid">
                  <Field label="แบรนด์" required>
                    <ButtonGroup value={form.brand} onChange={v => setForm(p => ({ ...p, brand: v }))} options={BRANDS} getColor={b => BC[b]} />
                  </Field>
                  <TField label="วันที่พบปัญหา" required type="date" value={form.date} onChange={setF("date")} />
                  <SField label="ประเภทสินค้า" options={PRODUCT_TYPES} value={form.productType} onChange={onProductChange} />
                  <TField label="สัปดาห์ยาง / Serial Number" required placeholder="เช่น 2524, SN-001" value={form.tireWeek} onChange={setF("tireWeek")} />
                  <TField label="รุ่นยาง" required placeholder="เช่น D-268" value={form.tireModel} onChange={setF("tireModel")} />
                  <TField label="ขนาดยาง" required placeholder="เช่น 185/65R15" value={form.tireSize} onChange={setF("tireSize")} />
                </div>
              </Card>

              <Card title="ข้อมูลปัญหา">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={S.lbl}>ประเภทปัญหา <span style={{ color: "#ef4444" }}>*</span> <span style={{ color: "#64748b", fontSize: 11 }}>(เลือกได้มากกว่า 1)</span></label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                      {issueTypesFor(form.productType).map(t => {
                        const checked = form.issueTypes.includes(t);
                        return (
                          <button key={t} onClick={() => toggleIssueType(t)}
                            style={{ ...S.btn, textAlign: "left", padding: "10px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, background: checked ? "#6366f120" : "#0f1117", color: checked ? "#fff" : "#94a3b8", border: "1.5px solid " + (checked ? "#6366f1" : "#2d3148") }}>
                            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: checked ? "#6366f1" : "transparent", border: "1.5px solid " + (checked ? "#6366f1" : "#475569"), color: "#fff", fontSize: 12 }}>{checked ? "✓" : ""}</span>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <TField label="รายละเอียดปัญหา" placeholder="ระบุรายละเอียดเพิ่มเติม" value={form.issueDetail} onChange={setF("issueDetail")} />
                </div>
              </Card>

              <Card title="ข้อมูลร้านค้า">
                <div className="form-grid">
                  <TField label="วันที่รับยางเคลม" required type="date" value={form.claimDate} onChange={setF("claimDate")} />
                  <TField label="เลขที่ใบเคลม" required placeholder="เช่น CLM-2026-001" value={form.claimRefNo} onChange={setF("claimRefNo")} />
                  <Field label="ประเภทยางเคลม">
                    <ButtonGroup value={form.claimType} onChange={v => setForm(p => ({ ...p, claimType: v }))} options={CLAIM_TYPES} getColor={() => "#6366f1"} />
                  </Field>
                  <TField label="ชื่อร้านค้า" required placeholder="ชื่อร้าน" value={form.shopName} onChange={setF("shopName")} />
                  <div style={S.colFull}>
                    <Field label="ประเภทร้าน (Tier)">
                      <ButtonGroup small value={form.shopTier}
                        onChange={v => setForm(p => ({ ...p, shopTier: v, distributorName: NEEDS_DIST.includes(v) ? p.distributorName : "" }))}
                        options={SHOP_TIERS} getColor={() => "#6366f1"} />
                    </Field>
                  </div>
                  {needsDist && (
                    <div style={S.colFull}>
                      <TField label="ร้านตัวแทนที่รับมา" required color="#f59e0b" style={{ borderColor: "#f59e0b" }}
                        placeholder="ชื่อร้านตัวแทน/ดิสทริบิวเตอร์" value={form.distributorName} onChange={setF("distributorName")} />
                    </div>
                  )}
                  <SField label="จังหวัดที่พบปัญหา" options={PROVINCES} value={form.province} onChange={setF("province")} />
                  <TField label="ผู้รายงาน" required placeholder="ชื่อ-นามสกุล" value={form.reporterName} onChange={setF("reporterName")} />
                </div>
              </Card>

              <Card title="ภาพถ่าย">
                <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addFiles} />
                <button onClick={() => imgRef.current.click()} style={{ ...S.btn, background: "#1e293b", color: "#94a3b8", padding: "10px 16px", border: "1.5px dashed #334155", width: "100%" }}>📷 เพิ่มภาพ</button>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />
                      <button onClick={() => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
                        style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10 }}>x</button>
                    </div>
                  ))}
                </div>
              </Card>

              <button className="btn-indigo" onClick={() => { if (validateForm()) setPreviewMode(true); }}
                style={{ ...S.btn, color: "#fff", padding: 14, fontSize: 16, width: "100%" }}>
                👁️ Preview ก่อนบันทึก
              </button>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {view === "form" && previewMode && (
          <div className="fu" style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setPreviewMode(false)} style={{ ...S.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← แก้ไข</button>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Preview ก่อนบันทึก</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <KVList title="ข้อมูลพื้นฐาน" items={[
                ["แบรนด์", form.brand], ["ประเภทสินค้า", form.productType], ["วันที่รับยางเคลม", form.claimDate || "-"],
                ["รุ่นยาง", form.tireModel || "-"], ["ขนาดยาง", form.tireSize || "-"], ["สัปดาห์ยาง / Serial", form.tireWeek || "-"],
              ]} />
              <KVList title="ปัญหา" items={[["ประเภทปัญหา", form.issueTypes.join(", ") || "-"], ["รายละเอียด", form.issueDetail || "-"]]} />
              <KVList title="ร้านค้า" items={[
                ["ร้านค้า", form.shopName], ["ประเภทร้าน", form.shopTier], ["ร้านตัวแทน", form.distributorName || "-"],
                ["จังหวัด", form.province], ["วันที่พบปัญหา", form.date || "-"], ["เลขที่ใบเคลม", form.claimRefNo || "-"],
                ["ประเภทยางเคลม", form.claimType], ["ผู้รายงาน", form.reporterName],
              ]} />

              {form.images.length > 0 && (
                <Card>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 12, marginBottom: 12 }}>ภาพถ่าย ({form.images.length} รูป)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {form.images.map((img, i) => <img key={i} src={img.url} alt="" style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />)}
                  </div>
                </Card>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setPreviewMode(false)} style={{ ...S.btn, flex: 1, background: "#334155", color: "#fff", padding: 14, fontSize: 15 }}>← กลับแก้ไข</button>
                <button className="btn-green" onClick={submit} style={{ ...S.btn, flex: 2, color: "#fff", padding: 14, fontSize: 16 }}>✓ ยืนยันบันทึกข้อมูล</button>
              </div>
            </div>
          </div>
        )}

        {/* LIST */}
        {view === "list" && !sel && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>รายการปัญหาทั้งหมด</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>พบ {listItems.length} รายการ{selectedIds.size > 0 ? " • เลือกอยู่ " + selectedIds.size + " รายการ" : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selectedIds.size > 0 && (
                  <button onClick={() => deleteMany([...selectedIds])} style={{ ...S.btn, background: "#ef4444", color: "#fff", padding: "10px 16px" }}>🗑️ ลบ {selectedIds.size} รายการ</button>
                )}
                <button onClick={exportCSV} style={{ ...S.btn, background: "#16a34a", color: "#fff", padding: "10px 20px" }}>📥 Export Excel</button>
              </div>
            </div>
            <Card style={{ marginBottom: 16 }}>
              <div className="list-filter-grid">
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ค้นหา</label><input style={S.inp} placeholder="รุ่นยาง, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>แบรนด์</label><select style={S.inp} value={fBrand} onChange={e => setFBrand(e.target.value)}><option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ปัญหา</label><select style={S.inp} value={fIssue} onChange={e => setFIssue(e.target.value)}><option>ทั้งหมด</option>{ALL_ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>สินค้า</label><select style={S.inp} value={fProd} onChange={e => setFProd(e.target.value)}><option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
            </Card>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1e2235", borderBottom: "1px solid #2d3148" }}>
                    <th style={{ padding: "12px 10px", width: 36 }}>
                      <input type="checkbox" style={{ width: 16, height: 16, cursor: "pointer" }}
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(i => i.id)) : new Set())} />
                    </th>
                    {[["เลขเคส", false], ["วันที่", true], ["แบรนด์", false], ["สินค้า", true], ["รุ่น / ขนาด", false], ["ปัญหา", false], ["สถานะ", false], ["ร้านค้า", true], ["จังหวัด", true], ["ผู้รายงาน", true]].map(([h, hide]) => (
                      <th key={h} className={hide ? "hide-mobile" : ""} style={{ padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listItems.length === 0
                    ? <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#475569" }}>ยังไม่มีข้อมูล</td></tr>
                    : listItems.map((issue, i) => {
                        const isCancelled = issue.cancelled;
                        const rowStyle = {
                          borderBottom: "1px solid #1e2235",
                          background: isCancelled ? "#1a0f0f" : (selectedIds.has(issue.id) ? "#6366f115" : (i % 2 === 0 ? "transparent" : "#14161f")),
                          opacity: isCancelled ? 0.55 : 1,
                          textDecoration: isCancelled ? "line-through" : "none",
                        };
                        const cellClick = isCancelled ? undefined : () => openDetail(issue);
                        const cellStyle = (extra) => ({ padding: "12px 14px", cursor: isCancelled ? "default" : "pointer", ...extra });
                        return (
                          <tr key={issue.id} style={rowStyle}>
                            <td style={{ padding: "12px 10px" }} onClick={e => e.stopPropagation()}>
                              {!isCancelled && (
                                <input type="checkbox" style={{ width: 16, height: 16, cursor: "pointer" }} checked={selectedIds.has(issue.id)}
                                  onChange={e => setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(issue.id); else next.delete(issue.id);
                                    return next;
                                  })} />
                              )}
                              {isCancelled && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>ยกเลิก</span>}
                            </td>
                            <td onClick={cellClick} style={cellStyle({ color: isCancelled ? "#64748b" : "#6366f1", fontWeight: 700, whiteSpace: "nowrap" })}>{issue.caseNo}</td>
                            <td onClick={cellClick} className="hide-mobile" style={cellStyle({ color: "#94a3b8", whiteSpace: "nowrap" })}>{issue.date}</td>
                            <td onClick={cellClick} style={cellStyle({})}><Badge bg={BC[issue.brand] + "25"} color={BC[issue.brand]}>{issue.brand}</Badge></td>
                            <td onClick={cellClick} className="hide-mobile" style={cellStyle({ color: "#94a3b8" })}>{issue.productType}</td>
                            <td onClick={cellClick} style={cellStyle({})}><div style={{ fontWeight: 600, color: "#e2e8f0" }}>{issue.tireModel}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.tireSize}</div></td>
                            <td onClick={cellClick} style={cellStyle({ color: "#e2e8f0", fontSize: 12 })}>{(issue.issueTypes || []).join(", ")}</td>
                            <td onClick={cellClick} style={cellStyle({ fontSize: 11, whiteSpace: "nowrap" })}>
                              {isCancelled ? "-" : (() => {
                                const label = factoryStatusLabel(issue);
                                if (!label) return <span style={{ color: "#475569" }}>ยังไม่ระบุ</span>;
                                const color = issue.factoryClosed ? "#22c55e" : "#0891b2";
                                const dotColor = issue.factoryClosed ? "#ef4444" : "#22c55e";
                                return (
                                  <>
                                    <span className="status-full" style={{ color, fontWeight: 600 }}>{label}</span>
                                    <span className="status-short" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }} title={issue.factoryClosed ? "ปิดเคส" : "กำลังดำเนินการ"}>
                                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
                                    </span>
                                  </>
                                );
                              })()}
                            </td>
                            <td onClick={cellClick} className="hide-mobile" style={cellStyle({})}><div style={{ color: "#e2e8f0" }}>{issue.shopName}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.shopTier}</div></td>
                            <td onClick={cellClick} className="hide-mobile" style={cellStyle({ color: "#94a3b8" })}>{issue.province}</td>
                            <td onClick={cellClick} className="hide-mobile" style={cellStyle({ color: "#94a3b8" })}>{issue.reporterName}</td>
                          </tr>
                        );
                      })}
                </tbody>
              </table></div>
            </Card>
          </div>
        )}

        {/* DETAIL */}
        {view === "list" && sel && (
          <div className="fu">
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => { setSel(null); setEditMode(false); setShowHistory(false); setFactoryEditMode(false); setShowEditChoice(false); }} style={{ ...S.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← กลับรายการ</button>
              <button onClick={() => exportPDF(sel)} style={{ ...S.btn, background: "#dc2626", color: "#fff", padding: "8px 20px" }}>📄 Export PDF</button>
              {!sel.cancelled && !editMode && !factoryEditMode && (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowEditChoice(v => !v)} style={{ ...S.btn, background: "#f59e0b", color: "#fff", padding: "8px 20px" }}>✏️ แก้ไข</button>
                  {showEditChoice && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: "#1a1d27", border: "1px solid #2d3148", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                      <button onClick={() => { setShowEditChoice(false); startEdit(); }} style={{ ...S.btn, background: "#f59e0b", color: "#fff", padding: "10px 14px", textAlign: "left" }}>📋 แก้ไขข้อมูลฝั่งเซล</button>
                      <button onClick={() => { setShowEditChoice(false); startFactoryEdit(); }} style={{ ...S.btn, background: "#0891b2", color: "#fff", padding: "10px 14px", textAlign: "left" }}>🏭 แก้ไขข้อมูลฝั่งโรงงาน</button>
                    </div>
                  )}
                </div>
              )}
              {!sel.cancelled && <button onClick={loadHistory} style={{ ...S.btn, background: showHistory ? "#6366f1" : "transparent", color: showHistory ? "#fff" : "#94a3b8", border: "1px solid " + (showHistory ? "#6366f1" : "#2d3148"), padding: "8px 20px" }}>🕐 ประวัติการแก้ไข</button>}
              {!sel.cancelled && <button onClick={() => deleteIssue(sel)} style={{ ...S.btn, background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "8px 20px", marginLeft: "auto" }}>🗑️ ยกเลิกเคส</button>}
              {sel.cancelled && <span style={{ marginLeft: "auto", color: "#ef4444", fontWeight: 700, fontSize: 13, padding: "8px 0" }}>⛔ เคสนี้ถูกยกเลิกแล้ว</span>}
            </div>

            {/* HISTORY PANEL */}
            {showHistory && (
              <Card style={{ marginBottom: 16, borderLeft: "4px solid #6366f1" }}>
                <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 14, marginBottom: 12 }}>🕐 ประวัติการแก้ไข ({historyData.length} ครั้ง)</div>
                {historyData.length === 0
                  ? <div style={{ color: "#64748b", fontSize: 13 }}>ยังไม่มีประวัติการแก้ไข</div>
                  : historyData.map((h, idx) => {
                    const snap = h.snapshot || {};
                    return (
                      <div key={h.id} style={{ borderBottom: "1px solid #1e2235", padding: "12px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>ครั้งที่ {historyData.length - idx} — {snap.reporterName || "-"}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(h.changed_at).toLocaleString("th-TH")}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                          {[["แบรนด์", snap.brand], ["ประเภทสินค้า", snap.productType], ["รุ่นยาง", snap.tireModel], ["ขนาดยาง", snap.tireSize], ["ประเภทปัญหา", (snap.issueTypes || []).join(", ")], ["ร้านค้า", snap.shopName], ["จังหวัด", snap.province]].map(([k, v]) => (
                            <div key={k}><span style={{ color: "#475569" }}>{k}: </span>{v || "-"}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </Card>
            )}

            {/* EDIT FORM */}
            {editMode && editForm && (
              <Card style={{ marginBottom: 16, borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 14, marginBottom: 16 }}>✏️ แก้ไขข้อมูลเคส {sel.caseNo}</div>
                <div className="form-grid">
                  <Field label="แบรนด์"><ButtonGroup value={editForm.brand} onChange={v => setEditForm(p => ({ ...p, brand: v }))} options={BRANDS} getColor={b => BC[b]} /></Field>
                  <TField label="วันที่พบปัญหา" type="date" value={editForm.date} onChange={setEF("date")} />
                  <SField label="ประเภทสินค้า" options={PRODUCT_TYPES} value={editForm.productType} onChange={onEditProductChange} />
                  <TField label="รุ่นยาง" required value={editForm.tireModel} onChange={setEF("tireModel")} />
                  <TField label="ขนาดยาง" value={editForm.tireSize} onChange={setEF("tireSize")} />
                  <TField label="สัปดาห์ยาง / Serial" value={editForm.tireWeek} onChange={setEF("tireWeek")} />
                  <TField label="วันที่รับยางเคลม" type="date" value={editForm.claimDate} onChange={setEF("claimDate")} />
                  <TField label="เลขที่ใบเคลม" value={editForm.claimRefNo} onChange={setEF("claimRefNo")} />
                  <div style={S.colFull}>
                    <Field label="ประเภทปัญหา *">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {issueTypesFor(editForm.productType).map(t => {
                          const checked = editForm.issueTypes.includes(t);
                          return (
                            <button key={t} onClick={() => toggleEditIssueType(t)}
                              style={{ ...S.btn, textAlign: "left", padding: "8px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 8, background: checked ? "#6366f120" : "#0f1117", color: checked ? "#fff" : "#94a3b8", border: "1.5px solid " + (checked ? "#6366f1" : "#2d3148") }}>
                              <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: checked ? "#6366f1" : "transparent", border: "1.5px solid " + (checked ? "#6366f1" : "#475569"), color: "#fff", fontSize: 11 }}>{checked ? "✓" : ""}</span>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </div>
                  <TField label="รายละเอียดปัญหา" value={editForm.issueDetail} onChange={setEF("issueDetail")} />
                  <TField label="ชื่อร้านค้า" required value={editForm.shopName} onChange={setEF("shopName")} />
                  <div style={S.colFull}>
                    <Field label="ประเภทร้าน">
                      <ButtonGroup small value={editForm.shopTier}
                        onChange={v => setEditForm(p => ({ ...p, shopTier: v, distributorName: NEEDS_DIST.includes(v) ? p.distributorName : "" }))}
                        options={SHOP_TIERS} getColor={() => "#6366f1"} />
                    </Field>
                  </div>
                  {NEEDS_DIST.includes(editForm.shopTier) && <TField label="ร้านตัวแทนที่รับมา" required value={editForm.distributorName} onChange={setEF("distributorName")} />}
                  <SField label="จังหวัด" options={PROVINCES} value={editForm.province} onChange={setEF("province")} />
                  <TField label="ผู้รายงาน" required value={editForm.reporterName} onChange={setEF("reporterName")} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => setEditMode(false)} style={{ ...S.btn, flex: 1, background: "#334155", color: "#fff", padding: 12 }}>ยกเลิก</button>
                  <button className="btn-green" onClick={saveEdit} style={{ ...S.btn, flex: 2, color: "#fff", padding: 12, fontSize: 15 }}>💾 บันทึกการแก้ไข</button>
                </div>
              </Card>
            )}

            {/* FACTORY EDIT FORM */}
            {factoryEditMode && factoryForm && (
              <Card style={{ marginBottom: 16, borderLeft: "4px solid #0891b2" }}>
                <div style={{ fontWeight: 700, color: "#0891b2", fontSize: 14, marginBottom: 16 }}>🏭 ข้อมูลโรงงาน — เคส {sel.caseNo}</div>
                <div className="form-grid">
                  <SField label="หน่วยงานที่รับผิดชอบ" options={["", ...FACTORY_DEPTS]} value={factoryForm.factoryDept} onChange={setFF("factoryDept")} />
                  <TField label="ผู้รับผิดชอบ" value={factoryForm.factoryResponsible} onChange={setFF("factoryResponsible")} />
                  <SField label="ต้นเหตุของปัญหา" options={["", ...FACTORY_CAUSES]} value={factoryForm.factoryCause} onChange={setFF("factoryCause")} />
                  <TField label="รายละเอียดต้นเหตุเพิ่มเติม" placeholder="ระบุรายละเอียด" value={factoryForm.factoryCauseDetail} onChange={setFF("factoryCauseDetail")} />
                  <TField label="กำหนดวันแก้ไขแล้วเสร็จ" type="date" value={factoryForm.factoryDueDate} onChange={setFF("factoryDueDate")} />
                  <div />

                  <div style={S.colFull}>
                    <Field label="รายละเอียดปัญหาที่พบ">
                      <textarea style={{ ...S.inp, minHeight: 80, resize: "vertical" }} value={factoryForm.factoryProblemDetail} onChange={setFF("factoryProblemDetail")} />
                    </Field>
                    <div style={{ marginTop: 8 }}>
                      <input id="factoryProblemImgInput" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addFactoryFiles("factoryProblemImages")} />
                      <button onClick={() => document.getElementById("factoryProblemImgInput").click()} style={{ ...S.btn, background: "#1e293b", color: "#94a3b8", padding: "8px 14px", border: "1.5px dashed #334155" }}>📷 แนบรูป</button>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {factoryForm.factoryProblemImages.map((img, i) => (
                          <div key={i} style={{ position: "relative" }}>
                            <img src={img.url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />
                            <button onClick={() => removeFactoryImage("factoryProblemImages", i)} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10 }}>x</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={S.colFull}>
                    <Field label="แผนการแก้ไข">
                      <textarea style={{ ...S.inp, minHeight: 80, resize: "vertical" }} value={factoryForm.factoryPlan} onChange={setFF("factoryPlan")} />
                    </Field>
                    <div style={{ marginTop: 8 }}>
                      <input id="factoryPlanImgInput" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addFactoryFiles("factoryPlanImages")} />
                      <button onClick={() => document.getElementById("factoryPlanImgInput").click()} style={{ ...S.btn, background: "#1e293b", color: "#94a3b8", padding: "8px 14px", border: "1.5px dashed #334155" }}>📷 แนบรูป</button>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {factoryForm.factoryPlanImages.map((img, i) => (
                          <div key={i} style={{ position: "relative" }}>
                            <img src={img.url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148" }} />
                            <button onClick={() => removeFactoryImage("factoryPlanImages", i)} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10 }}>x</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={S.colFull}>
                    <button onClick={() => setFactoryForm(p => ({ ...p, factoryClosed: !p.factoryClosed }))}
                      style={{ ...S.btn, display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: factoryForm.factoryClosed ? "#16a34a20" : "#0f1117", border: "1.5px solid " + (factoryForm.factoryClosed ? "#16a34a" : "#2d3148"), width: "100%" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: factoryForm.factoryClosed ? "#16a34a" : "transparent", border: "1.5px solid " + (factoryForm.factoryClosed ? "#16a34a" : "#475569"), color: "#fff", fontSize: 13 }}>{factoryForm.factoryClosed ? "✓" : ""}</span>
                      <span style={{ color: factoryForm.factoryClosed ? "#22c55e" : "#94a3b8", fontWeight: 600 }}>ปิดเคส</span>
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => setFactoryEditMode(false)} style={{ ...S.btn, flex: 1, background: "#334155", color: "#fff", padding: 12 }}>ยกเลิก</button>
                  <button className="btn-green" onClick={saveFactoryEdit} style={{ ...S.btn, flex: 2, color: "#fff", padding: 12, fontSize: 15 }}>💾 บันทึกข้อมูลโรงงาน</button>
                </div>
              </Card>
            )}

            <div className="detail-grid">
              <div style={{ ...S.card, gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16, minWidth: 0, maxWidth: "100%", flexWrap: "wrap", overflow: "hidden" }}>
                <img src="/deestone-logo.png" alt="Deestone" className="detail-logo" style={{ height: 64, width: "auto", flexShrink: 0, maxWidth: "100%" }} />
                <div className="detail-caseno" style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", letterSpacing: 0.5, minWidth: 0, maxWidth: "100%", wordBreak: "break-all", overflowWrap: "anywhere" }}>{sel.caseNo}</div>
              </div>

              <KVList title="ข้อมูลพื้นฐาน" items={[
                ["แบรนด์", sel.brand], ["ประเภทสินค้า", sel.productType], ["วันที่รับยางเคลม", sel.claimDate || "-"],
                ["รุ่นยาง", sel.tireModel || "-"], ["ขนาดยาง", sel.tireSize || "-"], ["สัปดาห์ยาง / Serial", sel.tireWeek || "-"],
              ]} />
              <KVList title="ปัญหา" items={[["ประเภทปัญหา", (sel.issueTypes || []).join(", ") || "-"], ["รายละเอียดปัญหา", sel.issueDetail || "-"]]} />
              <KVList title="ร้านค้า" items={[
                ["เลขที่ใบเคลม", sel.claimRefNo || "-"], ["ประเภทยางเคลม", sel.claimType || "-"], ["ชื่อร้าน", sel.shopName],
                ["ประเภทร้าน", sel.shopTier], ["ร้านตัวแทน", sel.distributorName || "-"], ["จังหวัดที่พบปัญหา", sel.province],
                ["วันที่พบปัญหา", sel.date || "-"],
              ]} />
              <KVList title="ผู้รายงาน" items={[["ชื่อ", sel.reporterName]]} />

              {!sel.imagesLoaded && (
                <Card><div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "8px 0" }}>📷 กำลังโหลดภาพถ่าย...</div></Card>
              )}
              {(sel.images || []).filter(i => i.url).length > 0 && (
                <Card>
                  <div style={{ fontWeight: 700, color: "#6366f1", fontSize: 13, marginBottom: 12 }}>ภาพถ่าย ({sel.images.filter(i => i.url).length} รูป)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {sel.images.filter(i => i.url).map((img, i) => (
                      <img key={i} src={img.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1.5px solid #2d3148", cursor: "pointer" }} onClick={() => window.open(img.url, "_blank")} />
                    ))}
                  </div>
                </Card>
              )}

              {(sel.factoryDept || sel.factoryCause || sel.factoryProblemDetail || sel.factoryPlan || sel.factoryClosed) && (
                <div style={S.colFull}>
                  <Card style={{ borderLeft: "4px solid #0891b2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "#0891b2", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>🏭 ข้อมูลโรงงาน</div>
                      {sel.factoryClosed
                        ? <Badge bg="#16a34a25" color="#22c55e">✅ ปิดเคสแล้ว</Badge>
                        : sel.factoryDept && <Badge bg="#0891b225" color="#0891b2">🔧 {sel.factoryDept} กำลังดำเนินการ</Badge>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 14, marginBottom: 12 }}>
                      <div><span style={{ color: "#64748b" }}>หน่วยงานที่รับผิดชอบ: </span>{sel.factoryDept || "-"}</div>
                      <div><span style={{ color: "#64748b" }}>ผู้รับผิดชอบ: </span>{sel.factoryResponsible || "-"}</div>
                      <div><span style={{ color: "#64748b" }}>ต้นเหตุของปัญหา: </span>{sel.factoryCause || "-"}{sel.factoryCauseDetail ? " (" + sel.factoryCauseDetail + ")" : ""}</div>
                      <div><span style={{ color: "#64748b" }}>กำหนดแก้ไขเสร็จ: </span>{sel.factoryDueDate || "-"}</div>
                    </div>
                    {sel.factoryUpdatedAt && (
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>🕐 บันทึกล่าสุดเมื่อ: {new Date(sel.factoryUpdatedAt).toLocaleString("th-TH")}</div>
                    )}
                    {sel.factoryProblemDetail && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>รายละเอียดปัญหาที่พบ</div>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{sel.factoryProblemDetail}</div>
                        {sel.factoryImagesLoaded && (sel.factoryProblemImages || []).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            {sel.factoryProblemImages.map((img, i) => (
                              <img key={i} src={img.url} alt="" style={{ width: 90, height: 68, objectFit: "cover", borderRadius: 6, border: "1.5px solid #2d3148", cursor: "pointer" }} onClick={() => window.open(img.url, "_blank")} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {sel.factoryPlan && (
                      <div>
                        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 4 }}>แผนการแก้ไข</div>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{sel.factoryPlan}</div>
                        {sel.factoryImagesLoaded && (sel.factoryPlanImages || []).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            {sel.factoryPlanImages.map((img, i) => (
                              <img key={i} src={img.url} alt="" style={{ width: 90, height: 68, objectFit: "cover", borderRadius: 6, border: "1.5px solid #2d3148", cursor: "pointer" }} onClick={() => window.open(img.url, "_blank")} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
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
