import { useState } from "react";
import "./VoltStockFieldQuickLog.css";
import "./VoltStockFieldQuickLog.mobile.css";

type Action = "use" | "receive" | "move";

const actionCopy: Record<Action, { title: string; sub: string; icon: string }> = {
  use: { title: "Log usage", sub: "Issue to a crew", icon: "↗" },
  receive: { title: "Receive stock", sub: "Add to inventory", icon: "+" },
  move: { title: "Move stock", sub: "Change location", icon: "⇄" },
};

export function VoltStockFieldQuickLog() {
  const [action, setAction] = useState<Action>("use");
  const [quantity, setQuantity] = useState("12");
  const [item, setItem] = useState("12/2 MC Cable");
  const [location, setLocation] = useState("North Loop · B-14");
  const [toast, setToast] = useState("");

  const submit = () => {
    setToast(`${actionCopy[action].title} saved · ${quantity} units`);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <main className="vq-shell">
      <div className="vq-wrap">
        <header className="vq-top">
          <div className="vq-brand">
            <div className="vq-mark">V</div>
            <div><strong>VoltStock</strong><span>FIELD OPERATIONS</span></div>
          </div>
          <div className="vq-status"><i className="vq-dot" /> Syncing live</div>
        </header>

        <section className="vq-hero">
          <div className="vq-kicker">Monday · 07:42 AM · North Loop</div>
          <h1>Make the count.<br /><em>Keep moving.</em></h1>
          <p>Quick actions for the field, with a clean trail back to the stockroom. No digging through menus.</p>
        </section>

        <section className="vq-grid">
          <article className="vq-card vq-primary">
            <div className="vq-card-head">
              <div><div className="vq-eyebrow">Quick entry</div><h2>What happened?</h2></div>
              <div className="vq-date">Today, Jun 24</div>
            </div>
            <div className="vq-actions" role="group" aria-label="Movement type">
              {(Object.keys(actionCopy) as Action[]).map((key) => (
                <button key={key} className={`vq-action ${action === key ? "active" : ""}`} onClick={() => setAction(key)} aria-pressed={action === key}>
                  <span className="vq-icon">{actionCopy[key].icon}</span><b>{actionCopy[key].title}</b><small>{actionCopy[key].sub}</small>
                </button>
              ))}
            </div>
            <div className="vq-form">
              <label className="vq-label" htmlFor="vq-item">Material</label>
              <select id="vq-item" className="vq-select" value={item} onChange={(e) => setItem(e.target.value)}>
                <option>12/2 MC Cable</option><option>¾″ EMT Conduit</option><option>4×4 Junction Box</option><option>20A AFCI Breaker</option>
              </select>
              <div className="vq-row">
                <div><label className="vq-label" htmlFor="vq-qty">Quantity</label><input id="vq-qty" className="vq-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" /></div>
                <div><label className="vq-label" htmlFor="vq-location">Location</label><select id="vq-location" className="vq-select" value={location} onChange={(e) => setLocation(e.target.value)}><option>North Loop · B-14</option><option>North Loop · B-09</option><option>South Annex · A-02</option></select></div>
              </div>
              <button className="vq-submit" onClick={submit}>Save {actionCopy[action].title.toLowerCase()} <span aria-hidden="true">→</span></button>
            </div>
          </article>

          <aside className="vq-side">
            <article className="vq-card vq-stat"><div className="vq-stat-top"><div className="vq-eyebrow">Crew progress</div><div className="vq-trend">+8.4%</div></div><h3>72%</h3><div className="vq-muted">of today’s planned material logged</div><div className="vq-bar"><i /></div></article>
            <article className="vq-card vq-stat"><div className="vq-eyebrow">On hand · North Loop</div><h3>1,284</h3><div className="vq-muted">units across 48 materials</div><div className="vq-trend" style={{ marginTop: 14 }}>6 need attention →</div></article>
            <article className="vq-card vq-recent"><div className="vq-eyebrow">Recent activity</div><div className="vq-list">
              <div className="vq-item"><i className="vq-item-dot" /><div><b>¾″ EMT Conduit</b><span>Maria S. · 6 min ago</span></div><strong>−24</strong></div>
              <div className="vq-item"><i className="vq-item-dot" /><div><b>20A AFCI Breaker</b><span>Receiving · 31 min ago</span></div><strong>+18</strong></div>
              <div className="vq-item"><i className="vq-item-dot" /><div><b>4×4 Junction Box</b><span>Chris L. · 1 hr ago</span></div><strong>−12</strong></div>
            </div></article>
          </aside>
        </section>
        {toast && <div className="vq-toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

export default VoltStockFieldQuickLog;