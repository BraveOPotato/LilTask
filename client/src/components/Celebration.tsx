import { useState, useEffect } from 'react';
import { appStore } from '../store/AppStore';

const EMOJIS = ['🎉','🥳','✨','🎊','🏆','💫','🌟','🎆'];

export function Celebration() {
  const [emoji,  setEmoji]  = useState('');
  const [active, setActive] = useState(false);

  useEffect(() => {
    return appStore.onCelebrate(() => {
      setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
      setActive(true);
      setTimeout(() => setActive(false), 2800);
    });
  }, []);

  return (
    <div id="celebration" className={active ? 'active' : ''}>
      <div className="celebrate-emoji">{emoji}</div>
    </div>
  );
}
