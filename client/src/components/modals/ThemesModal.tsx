import { appStore, THEMES } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';

export function ThemesModal() {
  const { close } = useModal();
  const { theme } = useStore();

  const dark  = THEMES.filter(t => t.dark);
  const light = THEMES.filter(t => !t.dark);

  function ThemeCard({ t }: { t: typeof THEMES[0] }) {
    const active      = t.id === theme;
    const [bg, a1, a2] = t.swatch;
    return (
      <div
        onClick={() => appStore.setTheme(t.id)}
        style={{
          cursor: 'pointer', padding: 10, borderRadius: 'var(--radius)',
          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          background: active ? 'var(--accent-glow)' : 'var(--bg3)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ background: bg, borderRadius: 6, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 7, border: t.dark ? undefined : '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: a1 }} />
          <div style={{ width: 9,  height: 9,  borderRadius: '50%', background: a2 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.label}</div>
        {active && <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>✓ active</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="modal-title">🎨 Themes</div>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Changes apply instantly.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
        <div style={{ gridColumn: '1/-1', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 2 }}>🌙 Dark</div>
        {dark.map(t  => <ThemeCard key={t.id} t={t} />)}
        <div style={{ gridColumn: '1/-1', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text3)', margin: '6px 0 2px' }}>☀️ Light</div>
        {light.map(t => <ThemeCard key={t.id} t={t} />)}
      </div>
      <div className="modal-actions">
        <button className="modal-btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}
