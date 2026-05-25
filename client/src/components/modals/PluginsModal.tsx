import { appStore, PLUGIN_DEFS } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';
import type { PluginState } from '../../models';

export function PluginsModal() {
  const { close } = useModal();
  useStore();
  const activeListId = appStore.activeListId;
  const activeList = appStore.activeList;

  if (!activeListId || !activeList) return null;

  const plugins = activeList.plugins;

  function toggle(id: keyof PluginState) {
    appStore.togglePlugin(activeListId!, id);
  }

  return (
    <div>
      <div className="modal-title">⚙ Plugins</div>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
        Applying to: <strong style={{ color: 'var(--text)' }}>{activeList.name}</strong>
      </p>

      {PLUGIN_DEFS.map(p => {
        const on = plugins[p.id];
        return (
          <div key={p.id} className={`plugin-card ${on ? 'enabled' : ''}`}>
            <div className="plugin-icon">{p.icon}</div>
            <div className="plugin-info">
              <div className="plugin-name">{p.name}</div>
              <div className="plugin-desc">{p.desc}</div>
            </div>
            <button
              className={`plugin-toggle ${on ? 'on' : ''}`}
              onClick={() => toggle(p.id)}
            />
          </div>
        );
      })}

      <div className="modal-actions">
        <button className="modal-btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}
