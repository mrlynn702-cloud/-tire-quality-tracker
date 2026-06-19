import { useState, useMemo, useRef, useEffect } from "react";

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

  /* responsive helpers */
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .filter-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .filter-row input, .filter-row select { width: auto; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .list-filter-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .hide-mobile { display: table-cell; }
  .nav-label-full { display: inline; }
  .nav-label-short { display: none; }
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

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
  }
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
      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2235", fontSize: 14 }}>
        <span style={{ color: "#64748b" }}>{k}</span>
        <span style={{ color: "#e2e8f0", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
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

// ---------- PDF builder ----------
function buildPdfHtml(issue) {
  const bColor = BC[issue.brand] || "#6366f1";
  const row = (lbl, val) => '<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;width:40%;border-bottom:1px solid #f1f5f9;">' + lbl + '</td><td style="padding:8px 12px;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">' + (val || "-") + '</td></tr>';
  const imgHTML = (issue.images || []).filter(i => i.url).map(img =>
    '<img src="' + img.url + '" style="width:160px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" />'
  ).join("");

  const styleTag = '<style>'
    + 'body{font-family:sans-serif;margin:0;padding:32px;color:#1e293b}'
    + '.hdr{background:#1a1d27;color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}'
    + '.cn{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;background:#e0e7ff;color:#4338ca;border:1px solid #c7d2fe;margin-bottom:8px}'
    + '.bb{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700}'
    + '.hl{border:2px solid ' + bColor + ';border-radius:10px;padding:16px 20px;margin-bottom:16px;display:flex}'
    + '.tc{flex:1;text-align:center;padding:8px 12px;border-right:1px solid #e2e8f0}'
    + '.tc:last-child{border-right:none}'
    + '.tclbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}'
    + '.tcval{font-size:20px;font-weight:800;color:#1e293b}'
    + '.sec{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}'
    + '.sech{background:#f8fafc;padding:10px 14px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0}'
    + 'table{width:100%;border-collapse:collapse}'
    + '.imgs{display:flex;flex-wrap:wrap;gap:10px;padding:12px}'
    + '.ftr{margin-top:32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}'
    + '@media print{.noprint{display:none!important}}'
    + '</style>';

  const toolbar = '<div class="noprint" style="position:fixed;top:0;left:0;right:0;background:#1a1d27;padding:12px 24px;display:flex;gap:10px;align-items:center;z-index:9999;">'
    + '<span style="color:#fff;font-weight:700;font-size:14px;flex:1;">' + issue.caseNo + ' &mdash; ' + issue.tireModel + ' ' + (issue.tireSize || '') + '</span>'
    + '<button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">พิมพ์ / บันทึก PDF</button>'
    + '<button onclick="window.close()" style="background:#475569;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:14px;cursor:pointer;">ปิด</button>'
    + '</div><div style="height:56px"></div>'
    + '<div class="noprint" style="background:#fef3c7;color:#92400e;padding:8px 24px;font-size:13px;text-align:center;">เมื่อหน้าพิมพ์เปิดขึ้น เลือก "ปลายทาง / Destination" เป็น <b>Save as PDF</b> แล้วกด Save เพื่อบันทึกไฟล์ลงเครื่อง</div>';

  const header = '<div class="hdr"><div>'
    + '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">รายงานปัญหาคุณภาพยาง</div>'
    + '<div class="cn">' + issue.caseNo + '</div><br/>'
    + '<span class="bb" style="background:' + bColor + '25;color:' + bColor + ';border:1px solid ' + bColor + '">' + issue.brand + '</span>'
    + ' <span style="font-size:12px;color:#94a3b8;">' + issue.productType + '</span>'
    + '</div><div style="text-align:right;">'
    + '<div style="font-size:11px;color:#94a3b8;">วันที่พบปัญหา</div>'
    + '<div style="font-size:18px;font-weight:700;color:#fff;">' + issue.date + '</div>'
    + (issue.claimDate ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">วันรับเคลม: ' + issue.claimDate + '</div>' : '')
    + '</div></div>';

  const highlight = '<div class="hl">'
    + '<div class="tc"><div class="tclbl">รุ่นยาง</div><div class="tcval" style="color:' + bColor + ';">' + (issue.tireModel || "-") + '</div></div>'
    + '<div class="tc"><div class="tclbl">ขนาด</div><div class="tcval">' + (issue.tireSize || "-") + '</div></div>'
    + '<div class="tc"><div class="tclbl">สัปดาห์ยาง/Serial</div><div class="tcval">' + (issue.tireWeek || "-") + '</div></div>'
    + '</div>';

  const issueSection = '<div class="sec"><div class="sech">ข้อมูลปัญหา</div><table>'
    + row("ประเภทปัญหา", issue.issueType)
    + row("รายละเอียดปัญหา", issue.issueDetail)
    + '</table></div>';

  const shopSection = '<div class="sec"><div class="sech">ข้อมูลร้านค้า</div><table>'
    + row("เลขที่ใบเคลม", issue.claimRefNo)
    + row("ประเภทยางเคลม", issue.claimType)
    + row("ชื่อร้านค้า", issue.shopName)
    + row("ประเภทร้าน", issue.shopTier)
    + row("ร้านตัวแทนที่รับมา", issue.distributorName)
    + row("จังหวัดที่พบปัญหา", issue.province)
    + row("วันที่รับยางเคลม", issue.claimDate)
    + row("ผู้รายงาน", issue.reporterName)
    + '</table></div>';

  const imagesSection = (issue.images || []).filter(i => i.url).length > 0
    ? '<div class="sec"><div class="sech">ภาพถ่าย</div><div class="imgs">' + imgHTML + '</div></div>' : '';

  const footer = '<div class="ftr">Tire Quality Tracker &mdash; Deestone &amp; Bluhorse | เลขเคส: ' + issue.caseNo
    + '<br/>&copy; ' + new Date().getFullYear() + ' Deestone Co., Ltd. | Developed by Apiwich Ruangsrisoragrai &mdash; 2W</div>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>' + issue.caseNo + '</title>' + styleTag + '</head><body>'
    + toolbar + header + highlight + issueSection + shopSection + imagesSection + footer + '</body></html>';
}

// ---------- App ----------
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
  const [fMonth, setFMonth] = useState("ทั้งปี");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const imgRef = useRef();

  const showToast = (msg, type) => {
    setToast({ msg, type: type || "ok" });
    setTimeout(() => setToast(null), 3000);
  };

  const setF = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    sbFetch("GET").then(data => {
      const mapped = data.map(r => ({
        id: r.id, caseNo: r.case_no, date: r.date, claimDate: r.claim_date,
        claimRefNo: r.claim_ref_no, claimType: r.claim_type || "New Defective",
        brand: r.brand, productType: r.product_type,
        tireModel: r.tire_model, tireSize: r.tire_size, tireWeek: r.tire_week,
        issueTypes: r.issue_types || (r.issue_type ? [r.issue_type] : []), issueDetail: r.issue_detail,
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
    if (!form.tireModel) return showToast("กรุณากรอกรุ่นยาง", "err"), false;
    if (form.issueTypes.length === 0) return showToast("กรุณาเลือกประเภทปัญหาอย่างน้อย 1 ข้อ", "err"), false;
    if (!form.reporterName) return showToast("กรุณากรอกผู้รายงาน", "err"), false;
    if (!form.shopName) return showToast("กรุณากรอกชื่อร้านค้า", "err"), false;
    if (NEEDS_DIST.includes(form.shopTier) && !form.distributorName) return showToast("กรุณากรอกร้านตัวแทนที่รับมา", "err"), false;
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
    const caseNo = "C" + yy + mm + dd + String(caseCounter).padStart(3, "0");
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
      setCaseCounter(c => c + 1);
      setForm(initForm());
      setPreviewMode(false);
      showToast("บันทึกสำเร็จ");
      setView("list");
    } catch {
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const deleteIssue = async (issue) => {
    if (!window.confirm("ยืนยันลบเคส " + issue.caseNo + " ? การลบไม่สามารถย้อนกลับได้")) return;
    try {
      await sbDelete(issue.id);
      setIssues(p => p.filter(i => i.id !== issue.id));
      setSel(null);
      showToast("ลบข้อมูลสำเร็จ");
    } catch {
      showToast("ลบไม่สำเร็จ กรุณาลองใหม่", "err");
    }
  };

  const filtered = useMemo(() => issues.filter(i => {
    const q = search.toLowerCase();
    return (!q || [i.tireModel, i.shopName, i.reporterName, i.province, (i.issueTypes || []).join(" ")].some(v => (v || "").toLowerCase().includes(q)))
      && (fBrand === "ทั้งหมด" || i.brand === fBrand)
      && (fIssue === "ทั้งหมด" || (i.issueTypes || []).includes(fIssue))
      && (fProd === "ทั้งหมด" || i.productType === fProd);
  }), [issues, search, fBrand, fIssue, fProd]);

  const exportCSV = () => {
    const imgUrls = (i) => (i.images || []).filter(im => im.url && !im.url.startsWith("data:")).map(im => im.url);
    const maxImgs = Math.max(0, ...filtered.map(i => imgUrls(i).length));
    const imgHeaders = Array.from({ length: maxImgs }, (_, k) => "รูปที่ " + (k + 1));
    const h = ["เลขเคส","เลขที่ใบเคลม","ประเภทยางเคลม","วันที่","วันที่รับเคลม","แบรนด์","ประเภทสินค้า","รุ่นยาง","ขนาด","สัปดาห์ยาง/Serial","ประเภทปัญหา","รายละเอียดปัญหา","ผู้รายงาน","ร้านค้า","ประเภทร้าน","ร้านตัวแทน","จังหวัด", ...imgHeaders];
    const rows = filtered.map(i => {
      const urls = imgUrls(i);
      const imgCols = Array.from({ length: maxImgs }, (_, k) => urls[k] || "");
      return [
        i.caseNo, i.claimRefNo, i.claimType, i.date, i.claimDate, i.brand, i.productType,
        i.tireModel, i.tireSize, i.tireWeek, i.issueType, i.issueDetail, i.reporterName,
        i.shopName, i.shopTier, i.distributorName, i.province, ...imgCols,
      ];
    });
    const csv = [h, ...rows].map(r => r.map(v => '"' + (v || "").toString().replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    a.download = "tire_quality.csv";
    a.click();
    showToast("Export CSV สำเร็จ");
  };

  const exportPDF = (issue) => {
    const win = window.open("", "_blank");
    win.document.write(buildPdfHtml(issue));
    win.document.close();
  };

  const total = issues.length;
  const ptCounts = PRODUCT_TYPES.map(t => ({ t, c: filtered.filter(i => i.productType === t).length }));
  const pvCounts = [...new Set(filtered.map(i => i.province))].map(p => ({ p, c: filtered.filter(i => i.province === p).length })).sort((a, b) => b.c - a.c).slice(0, 5);
  const needsDist = NEEDS_DIST.includes(form.shopTier);
  const hasFilters = search || fBrand !== "ทั้งหมด" || fIssue !== "ทั้งหมด" || fProd !== "ทั้งหมด";

  const navGo = (v) => { setView(v); setSel(null); setPreviewMode(false); };
  const clearFilters = () => { setSearch(""); setFBrand("ทั้งหมด"); setFIssue("ทั้งหมด"); setFProd("ทั้งหมด"); };

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

      {toast && <div className={"toast toast-" + toast.type}>{toast.msg}</div>}

      <div style={S.hdr}>
        <div className="header-inner" style={S.hdrIn}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="logo-icon" style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>Tire Quality Tracker</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Deestone &amp; Bluhorse</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["dashboard", "📊", "Dashboard"], ["form", "➕", "บันทึก"], ["list", "📋", "รายการ"]].map(([v, icon, l]) => (
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
                <input style={{ ...S.inp, width: 200 }} placeholder="🔍 ค้นหา รุ่น, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...S.inp, width: 140 }} value={fBrand} onChange={e => setFBrand(e.target.value)}>
                  <option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
                <select style={{ ...S.inp, width: 150 }} value={fIssue} onChange={e => setFIssue(e.target.value)}>
                  <option>ทั้งหมด</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select style={{ ...S.inp, width: 150 }} value={fProd} onChange={e => setFProd(e.target.value)}>
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

              {/* Bar: ประเภทปัญหา */}
              <BarChart title="แบ่งตามประเภทปัญหา" color="#6366f1" items={ISSUE_TYPES.map((t, i) => ({
                label: t, color: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#64748b"][i % 5],
                count: filtered.filter(x => x.issueType === t).length,
              }))} />

              {/* Bar: Tire/Tube */}
              <BarChart title="แบ่งตามยาง Tire / Tube" items={[
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
                  <SField label="ประเภทสินค้า" options={PRODUCT_TYPES} value={form.productType} onChange={setF("productType")} />
                  <TField label="สัปดาห์ยาง / Serial Number" placeholder="เช่น 2524, SN-001" value={form.tireWeek} onChange={setF("tireWeek")} />
                  <TField label="รุ่นยาง" required placeholder="เช่น D-268" value={form.tireModel} onChange={setF("tireModel")} />
                  <TField label="ขนาดยาง" placeholder="เช่น 185/65R15" value={form.tireSize} onChange={setF("tireSize")} />
                </div>
              </Card>

              <Card title="ข้อมูลปัญหา">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <SField label="ประเภทปัญหา" options={ISSUE_TYPES} value={form.issueType} onChange={setF("issueType")} />
                  <TField label="รายละเอียดปัญหา" placeholder="ระบุรายละเอียดเพิ่มเติม" value={form.issueDetail} onChange={setF("issueDetail")} />
                </div>
              </Card>

              <Card title="ข้อมูลร้านค้า">
                <div className="form-grid">
                  <TField label="วันที่รับยางเคลม" type="date" value={form.claimDate} onChange={setF("claimDate")} />
                  <TField label="เลขที่ใบเคลม" placeholder="เช่น CLM-2026-001" value={form.claimRefNo} onChange={setF("claimRefNo")} />
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
              <div style={{ ...S.card, borderLeft: "4px solid #6366f1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Badge bg={BC[form.brand] + "25"} color={BC[form.brand]}>{form.brand}</Badge>
                    <Badge bg="#2d3148" color="#94a3b8">{form.productType}</Badge>
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{form.date}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{form.tireModel} {form.tireSize}</div>
                <div style={{ fontSize: 13, color: "#6366f1" }}>สัปดาห์ยาง / Serial: {form.tireWeek || "-"}</div>
              </div>

              <KVList title="ปัญหา" items={[["ประเภทปัญหา", form.issueType], ["รายละเอียด", form.issueDetail || "-"]]} />
              <KVList title="ร้านค้า" items={[
                ["ร้านค้า", form.shopName], ["ประเภทร้าน", form.shopTier], ["ร้านตัวแทน", form.distributorName || "-"],
                ["จังหวัด", form.province], ["วันรับเคลม", form.claimDate || "-"], ["เลขที่ใบเคลม", form.claimRefNo || "-"],
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>รายการปัญหาทั้งหมด</h2>
                <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>พบ {filtered.length} รายการ</p>
              </div>
              <button onClick={exportCSV} style={{ ...S.btn, background: "#16a34a", color: "#fff", padding: "10px 20px" }}>📥 Export CSV</button>
            </div>
            <Card style={{ marginBottom: 16 }}>
              <div className="list-filter-grid">
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ค้นหา</label><input style={S.inp} placeholder="รุ่นยาง, ร้าน, จังหวัด..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>แบรนด์</label><select style={S.inp} value={fBrand} onChange={e => setFBrand(e.target.value)}><option>ทั้งหมด</option>{BRANDS.map(b => <option key={b}>{b}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>ปัญหา</label><select style={S.inp} value={fIssue} onChange={e => setFIssue(e.target.value)}><option>ทั้งหมด</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>สินค้า</label><select style={S.inp} value={fProd} onChange={e => setFProd(e.target.value)}><option>ทั้งหมด</option>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
            </Card>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1e2235", borderBottom: "1px solid #2d3148" }}>
                    {[["เลขเคส", false], ["วันที่", false], ["แบรนด์", false], ["สินค้า", true], ["รุ่น / ขนาด", false], ["ปัญหา", false], ["ร้านค้า", true], ["จังหวัด", true], ["ผู้รายงาน", true]].map(([h, hide]) => (
                      <th key={h} className={hide ? "hide-mobile" : ""} style={{ padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#475569" }}>ยังไม่มีข้อมูล</td></tr>
                    : filtered.map((issue, i) => (
                      <tr key={issue.id} className="rh" onClick={() => setSel(issue)} style={{ borderBottom: "1px solid #1e2235", background: i % 2 === 0 ? "transparent" : "#14161f" }}>
                        <td style={{ padding: "12px 14px", color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>{issue.caseNo}</td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8", whiteSpace: "nowrap" }}>{issue.date}</td>
                        <td style={{ padding: "12px 14px" }}><Badge bg={BC[issue.brand] + "25"} color={BC[issue.brand]}>{issue.brand}</Badge></td>
                        <td className="hide-mobile" style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.productType}</td>
                        <td style={{ padding: "12px 14px" }}><div style={{ fontWeight: 600, color: "#e2e8f0" }}>{issue.tireModel}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.tireSize}</div></td>
                        <td style={{ padding: "12px 14px", color: "#e2e8f0" }}>{issue.issueType}</td>
                        <td className="hide-mobile" style={{ padding: "12px 14px" }}><div style={{ color: "#e2e8f0" }}>{issue.shopName}</div><div style={{ fontSize: 11, color: "#64748b" }}>{issue.shopTier}</div></td>
                        <td className="hide-mobile" style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.province}</td>
                        <td className="hide-mobile" style={{ padding: "12px 14px", color: "#94a3b8" }}>{issue.reporterName}</td>
                      </tr>
                    ))}
                </tbody>
              </table></div>
            </Card>
          </div>
        )}

        {/* DETAIL */}
        {view === "list" && sel && (
          <div className="fu">
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button onClick={() => setSel(null)} style={{ ...S.btn, background: "transparent", color: "#94a3b8", border: "1px solid #2d3148", padding: "8px 16px" }}>← กลับรายการ</button>
              <button onClick={() => exportPDF(sel)} style={{ ...S.btn, background: "#dc2626", color: "#fff", padding: "8px 20px" }}>📄 Export PDF</button>
              <button onClick={() => deleteIssue(sel)} style={{ ...S.btn, background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "8px 20px", marginLeft: "auto" }}>🗑️ ลบข้อมูล</button>
            </div>
            <div className="detail-grid">
              <div style={{ ...S.card, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="logo-icon" style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔧</div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, marginBottom: 4 }}>{sel.caseNo}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{sel.tireModel} {sel.tireSize}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <Badge bg={BC[sel.brand] + "25"} color={BC[sel.brand]}>{sel.brand}</Badge>
                      <Badge bg="#2d3148" color="#94a3b8">{sel.productType}</Badge>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", color: "#64748b", fontSize: 13 }}>
                  <div>{sel.date}</div>
                  <div style={{ color: "#6366f1" }}>{sel.tireWeek}</div>
                </div>
              </div>

              <KVList title="ปัญหา" items={[["ประเภทปัญหา", sel.issueType], ["รายละเอียดปัญหา", sel.issueDetail || "-"]]} />
              <KVList title="ร้านค้า" items={[
                ["เลขที่ใบเคลม", sel.claimRefNo || "-"], ["ประเภทยางเคลม", sel.claimType || "-"], ["ชื่อร้าน", sel.shopName],
                ["ประเภทร้าน", sel.shopTier], ["ร้านตัวแทน", sel.distributorName || "-"], ["จังหวัดที่พบปัญหา", sel.province],
                ["วันที่รับยางเคลม", sel.claimDate || "-"],
              ]} />
              <KVList title="ผู้รายงาน" items={[["ชื่อ", sel.reporterName]]} />

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
