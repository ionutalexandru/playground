'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Circle, 
  Hexagon, 
  Sparkles, 
  XOctagon, 
  HelpCircle, 
  Gift,
  RotateCcw,
  CheckCircle2,
  Coins,
  ArrowUpRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import styles from './rasca.module.css';

// Editable configuration parameter for max allowed Bronze prizes
const MAX_BRONZE_PRIZES = 3;

// SVG icon mapping with Mario Bros color patterns
const ICON_MAP = {
  'BRONZE': <Circle size={32} strokeWidth={3} color="#c59b76" />,
  'SILVER': <Hexagon size={32} strokeWidth={3} color="#0070cd" />,
  'GOLDEN': <Sparkles size={32} strokeWidth={3} color="#fdb924" />,
  'FAIL': <XOctagon size={32} strokeWidth={3} color="#e52521" />
};

// Hidden reward boards database (Base clean data structure)
const initialCatalog = {
  'BRONZE': [
    { id: 'b1', name: '🎿 Llevarse los esquís de Cris del trastero', revealed: false },
    { id: 'b2', name: '🖌 Pintar cerámica', revealed: false },
    { id: 'b3', name: '🔥 Bombona de gas', revealed: false },
    { id: 'b4', name: '🛌 Sábanas para la cama', revealed: false },
    { id: 'b5', name: '🧘‍♂️ Sesión de masaje', revealed: false }
  ],
  'SILVER': [
    { id: 's1', name: '🥾 Zapatillas de Salomon', revealed: false },
    { id: 's2', name: '🥐 Experiencia gastronómica', revealed: false },
    { id: 's3', name: '🏔 Finde en la montaña', revealed: false }
  ],
  'GOLDEN': [
    { id: 'g1', name: '✈ Billete avión para tu viaje largo (contribución)', revealed: false },
    { id: 'g2', name: '🚲 Bici road/gravel (contribución)', revealed: false }
  ]
};

// Helper function to shuffle any array randomly (Fisher-Yates Algorithm)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates a dynamic 9-cell grid based on a 10-level progressive difficulty curve.
 * - Bronze drops smoothly from Level 1 to 10.
 * - Silver peaks in the mid-game (Levels 4-7).
 * - Golden scales up exponentially towards the late game.
 * - Fallo (X) is tightly capped: starts at 1 and will NEVER exceed 2 (3 max at level 10).
 */
function generateDynamicCard(level: number) {
  const pool: string[] = [];
  const totalCells = 9;
  const progress = (level - 1) / 9; 

  // Bronze: Starts at 6 cells, drops down smoothly
  const bronzeCount = Math.max(1, Math.round(6 * (1 - progress)));
  
  {/* Fallo (X) Cap: Starts at 1 cell, very slowly moves to 2, and hits exactly 3 at level 10 */}
  const falloCount = level === 10 ? 3 : Math.min(2, Math.round(1 + 1.2 * progress));
  
  // Golden: Spikes towards the late game (up to 3 cells max)
  const goldenCount = level < 4 ? 0 : Math.min(3, Math.round(Math.pow(progress, 2) * 3));
  
  // Silver: Dynamically fills the remaining spots
  const silverCount = Math.max(0, totalCells - (bronzeCount + falloCount + goldenCount));

  // Push calculated tokens into the pool
  for (let i = 0; i < bronzeCount; i++) pool.push('BRONZE');
  for (let i = 0; i < silverCount; i++) pool.push('SILVER');
  for (let i = 0; i < goldenCount; i++) pool.push('GOLDEN');
  for (let i = 0; i < falloCount; i++) pool.push('FAIL');

  // Shuffle the result cleanly
  return shuffleArray(pool);
}

export default function RascaYGana() {
  const [cardsDeck, setCardsDeck] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [revealedCells, setRevealedCells] = useState<number[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [inventory, setInventory] = useState({ 'BRONZE': 0, 'SILVER': 0, 'GOLDEN': 0 });
  const [stage, setStage] = useState<'game' | 'bank' | 'catalog' | 'dispute' | 'final'>('game');
  const [modal, setModal] = useState({ show: false, title: '', text: '', icon: null as any });
  const [showHelp, setShowHelp] = useState(false);
  const [catalog, setCatalog] = useState(initialCatalog);
  
  const [prizesWonCount, setPrizesWonCount] = useState({ 'BRONZE': 0, 'SILVER': 0, 'GOLDEN': 0 });
  const [selectedPrizes, setSelectedPrizes] = useState<string[]>([]);
  const [disputedReveals, setDisputedReveals] = useState({ 'BRONZE': false, 'SILVER': false, 'GOLDEN': false });

  const certificateRef = useRef<HTMLDivElement>(null);

  // Initialize randomized setups on cold start mount
  useEffect(() => {
    const progressiveDeck = [];
    for (let i = 1; i <= 10; i++) {
      progressiveDeck.push({ id: i, grid: generateDynamicCard(i) });
    }
    setCardsDeck(progressiveDeck);

    setCatalog({
      'BRONZE': shuffleArray(initialCatalog.BRONZE),
      'SILVER': shuffleArray(initialCatalog.SILVER),
      'GOLDEN': shuffleArray(initialCatalog.GOLDEN)
    });
  }, []);

  const currentCard = cardsDeck[currentCardIndex];

  // Logic processing grid node hit events with strict pair verification
  const handleCellClick = (idx: number, symbol: string) => {
    if (revealedCells.length >= 3 || revealedCells.includes(idx)) return;

    const newRevealed = [...revealedCells, idx];
    const newSymbols = [...selectedSymbols, symbol];
    setRevealedCells(newRevealed);
    setSelectedSymbols(newSymbols);

    if (newRevealed.length === 3) {
      setTimeout(() => {
        const first = newSymbols[0];
        
        // Condition: Trio verification (3 matching elements, no failure items allowed)
        const isTrio = newSymbols.every(s => s === first && s !== 'FAIL');
        
        // Condition: Global presence filter for failure items
        const hasFallo = newSymbols.includes('FAIL');
        
        // Condition: Evaluate content variation inside the panel
        const uniqueSetCount = new Set(newSymbols).size;

        if (isTrio) {
          setInventory(prev => ({ ...prev, [first]: prev[first as keyof typeof prev] + 1 }));
          setModal({
            show: true,
            title: "¡SÚPER TRÍO!",
            text: `¡Brutal! Has alineado tres figuras idénticas y ganas una moneda ${first}.`,
            icon: <CheckCircle2 size={54} color="#43a047" />
          });
        } else if (!hasFallo && uniqueSetCount === 3) {
          // Combo Heterogéneo: 3 completely unique valid items
          setInventory(prev => ({ ...prev, 'GOLDEN': prev.GOLDEN + 1 }));
          setModal({
            show: true,
            title: "¡COMBO HETEROGÉNEO!",
            text: "¡Alucinante! Has revelado tres figuras totalmente distintas. ¡Premio Gordo: Moneda Suprema!",
            icon: <Sparkles size={54} color="#fdb924" />
          });
        } else if (!hasFallo && uniqueSetCount === 2) {
          {/* Strict Rule: Exactly 2 matching valid items, absolutely no 'X' allowed */}
          setInventory(prev => ({ ...prev, 'BRONZE': prev.BRONZE + 1 }));
          setModal({
            show: true,
            title: "¡PAREJA DE CONSOLACIÓN!",
            text: "¡Casi! Has conseguido dos figuras válidas iguales en el panel. Te llevas una moneda de Bronce.",
            icon: <Coins size={54} color="#c59b76" />
          });
        } else {
          setModal({
            show: true,
            title: "¡OH NO!",
            text: "Los bloques no coinciden o ha caído una X eliminatoria. ¡Prueba en el siguiente nivel!",
            icon: <XOctagon size={54} color="#e52521" />
          });
        }
      }, 400);
    }
  };

  // Logic processing reward board card flip validation
  const handleFlipCard = (category: keyof typeof initialCatalog, index: number) => {
    if (inventory[category] <= 0) return;

    const prize = catalog[category][index];

    if (prize.revealed) {
      setModal({
        show: true,
        title: "BLOQUE YA ABIERTO",
        text: "Este premio ya ha sido descubierto antes. ¡Elige una carta diferente sin perder tu ficha!",
        icon: <RotateCcw size={48} color="#fdb924" />
      });
      return;
    }

    if (category === 'BRONZE' && prizesWonCount.BRONZE >= MAX_BRONZE_PRIZES) {
      setModal({
        show: true,
        title: "LÍMITE ALCANZADO",
        text: `¡No puedes acumular más de ${MAX_BRONZE_PRIZES} premios de Bronce! Conservas tu moneda para intercambiarla en la central.`,
        icon: <XOctagon size={48} color="#e52521" />
      });
      return;
    }

    const newCatalog = { ...catalog };
    newCatalog[category][index].revealed = true;
    setCatalog(newCatalog);
    
    const updatedPrizesList = [...selectedPrizes, prize.name];
    const updatedPrizesCount = { ...prizesWonCount, [category]: prizesWonCount[category] + 1 };
    
    setSelectedPrizes(updatedPrizesList);
    setPrizesWonCount(updatedPrizesCount);
    setInventory(prev => ({ ...prev, [category]: prev[category] - 1 }));

    const totalPossibleMaxPrizes = 1 + 1 + MAX_BRONZE_PRIZES;
    const totalPrizesRevealed = updatedPrizesCount.GOLDEN + updatedPrizesCount.SILVER + updatedPrizesCount.BRONZE;

    if (totalPrizesRevealed >= totalPossibleMaxPrizes) {
      setModal({
        show: true,
        title: "¡JUEGO COMPLETADO!",
        text: "¡Espectacular! Has desbloqueado el número máximo de premios permitidos por las reglas del Reino. Las monedas restantes se han desvanecido.",
        icon: <Coins size={54} color="#fdb924" />
      });
    }
  };

  const handleDisputeFlip = (category: keyof typeof initialCatalog) => {
    if (disputedReveals[category]) return;

    const targetIdx = catalog[category].findIndex(p => !p.revealed);
    if (targetIdx === -1) return;

    const prize = catalog[category][targetIdx];

    const newCatalog = { ...catalog };
    newCatalog[category][targetIdx].revealed = true;
    setCatalog(newCatalog);
    setSelectedPrizes(prev => [...prev, prize.name]);
    setDisputedReveals(prev => ({ ...prev, [category]: true }));
  };

  const triggerVoluntaryDispute = () => {
    setSelectedPrizes([]);
    setPrizesWonCount({ 'BRONZE': 0, 'SILVER': 0, 'GOLDEN': 0 });
    setInventory({ 'BRONZE': 0, 'SILVER': 0, 'GOLDEN': 0 });
    
    const resetCatalog = { ...catalog };
    Object.keys(resetCatalog).forEach(cat => {
      const arrayKey = cat as keyof typeof initialCatalog;
      resetCatalog[arrayKey].forEach(p => p.revealed = false);
      resetCatalog[arrayKey] = shuffleArray(resetCatalog[arrayKey]);
    });
    setCatalog(resetCatalog);
    setStage('dispute');
  };

  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    try {
      const canvas = await html2canvas(certificateRef.current, {
        backgroundColor: '#fbf9f6',
        scale: 2,
        logging: false
      });
      const imageURI = canvas.toDataURL('image/png');
      const hiddenDownloadLink = document.createElement('a');
      hiddenDownloadLink.href = imageURI;
      hiddenDownloadLink.download = 'regalos.png';
      hiddenDownloadLink.click();
    } catch (error) {
      console.error("Failed executing canvas export:", error);
    }
  };

  const executeTrade = (type: string) => {
    setInventory(prev => {
      const upd = { ...prev };
      if (type === 'b2p' && upd.BRONZE >= 3) { upd.BRONZE -= 3; upd.SILVER += 1; }
      if (type === 'p2g' && upd.SILVER >= 3) { upd.SILVER -= 3; upd.GOLDEN += 1; }
      
      if (type === 'clearGoldenDuplicate' && upd.GOLDEN > 1) { upd.GOLDEN -= 1; upd.BRONZE += 1; }
      if (type === 'clearSilverDuplicate' && upd.SILVER > 1) { upd.SILVER -= 1; upd.BRONZE += 1; }
      
      return upd;
    });
  };

  const totalInventory = inventory.BRONZE + inventory.SILVER + inventory.GOLDEN;
  const requiresDuplicateResolution = inventory.GOLDEN > 1 || inventory.SILVER > 1;

  const goldenSectionLocked = prizesWonCount.GOLDEN >= 1 || inventory.GOLDEN === 0;
  const silverSectionLocked = prizesWonCount.SILVER >= 1 || inventory.SILVER === 0;
  const bronzeSectionLocked = prizesWonCount.BRONZE >= MAX_BRONZE_PRIZES || inventory.BRONZE === 0;

  const boardFullyLockedGlobally = goldenSectionLocked && silverSectionLocked && bronzeSectionLocked;
  const allowFinalTransition = totalInventory === 0 || boardFullyLockedGlobally;

  if (!currentCard) return <div className={styles.body}><p className={styles.subtitle}>Generando Tableros del Reino...</p></div>;

  return (
    <div className={styles.body}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Rasca y gana</h1>
        <p className={styles.subtitle}>Edición Especial: 10º Aniversario y cumple de Jesús</p>
      </header>

      <main className={styles.gameContainer}>
        {/* STAGE 1: Scratch Grid Phase */}
        {stage === 'game' && (
          <div key="game-wrapper">
            <div className={styles.statusBar}>
              <span>Mundo {currentCardIndex + 1}/{cardsDeck.length}</span>
              <button className={styles.helpIconBtn} onClick={() => setShowHelp(true)}>
                <HelpCircle size={22} />
              </button>
            </div>
            <p className={styles.instructions}>Golpea 3 bloques interrogación para buscar combinaciones.</p>
            <div className={styles.grid}>
              {currentCard.grid.map((symbol: string, idx: number) => (
                <div 
                  key={idx} 
                  className={`${styles.cell} ${revealedCells.includes(idx) ? styles.cellRevealed : ''}`}
                  onClick={() => handleCellClick(idx, symbol)}
                >
                  {revealedCells.includes(idx) ? ICON_MAP[symbol as keyof typeof ICON_MAP] : <span className={styles.cellQuestionMark}>?</span>}
                </div>
              ))}
            </div>
            <button 
              className={styles.btn} 
              disabled={revealedCells.length < 3}
              onClick={() => {
                if (currentCardIndex < cardsDeck.length - 1) {
                  setCurrentCardIndex(prev => prev + 1);
                  setRevealedCells([]);
                  setSelectedSymbols([]);
                } else {
                  setStage('bank');
                }
              }}
            >
              {currentCardIndex < cardsDeck.length - 1 ? "Siguiente Nivel" : "Ir a la Casa de Toad"}
            </button>
          </div>
        )}

        {/* STAGE 2: Trading Board Phase */}
        {stage === 'bank' && (
          <div key="bank-wrapper">
            <h2 className={styles.h1}>🏛️ Tienda de Intercambio</h2>
            <p className={styles.subtitle}>Combina tus monedas de forma ascendente</p>
            
            <button className={styles.tradeBtn} onClick={() => executeTrade('b2p')} disabled={inventory.BRONZE < 3 || requiresDuplicateResolution}>
              <span>Evolucionar: 3x Bronce ➜ 1x Plata</span> <Hexagon size={16} color="#0070cd" />
            </button>
            <button className={styles.tradeBtn} onClick={() => executeTrade('p2g')} disabled={inventory.SILVER < 3 || requiresDuplicateResolution}>
              <span>Gran Pacto: 3x Plata ➜ 1x Suprema</span> <Sparkles size={16} color="#fdb924" />
            </button>

            {inventory.GOLDEN > 1 && (
              <button className={`${styles.tradeBtn} ${styles.tradeBtnDuplicate}`} onClick={() => executeTrade('clearGoldenDuplicate')}>
                <span>⚠️ Duplicado: 1x Suprema ➜ 1x Bronce Extra</span> <Circle size={16} color="#c59b76" />
              </button>
            )}
            {inventory.SILVER > 1 && (
              <button className={`${styles.tradeBtn} ${styles.tradeBtnDuplicate}`} onClick={() => executeTrade('clearSilverDuplicate')}>
                <span>⚠️ Duplicado: 1x Plata ➜ 1x Bronce Extra</span> <Circle size={16} color="#c59b76" />
              </button>
            )}

            <button 
              className={`${styles.btn} ${styles.btnGreen}`} 
              onClick={() => setStage('catalog')} 
              disabled={requiresDuplicateResolution}
            >
              Entrar por la Tubería de Premios
            </button>
          </div>
        )}

        {/* STAGE 3: Mystery Card Flip Store Phase */}
        {stage === 'catalog' && (
          <div key="catalog-wrapper">
            <h2 className={styles.h1}>🃏 Paneles del Destino</h2>
            <p className={styles.subtitle}>Consigue un premio por rango de categoría</p>
            
            <div className={`${styles.catalogSectionHeader} ${styles.colorGolden}`}>NIVEL SUPREMO DISPONIBLE ({inventory.GOLDEN})</div>
            <div className={styles.cardsCatalogGrid}>
              {catalog.GOLDEN.map((p, i) => (
                <div 
                  key={p.id} 
                  className={`${styles.mysteryCard} ${p.revealed ? styles.mysteryCardRevealed : ''} ${!p.revealed && (inventory.GOLDEN <= 0 || prizesWonCount.GOLDEN >= 1 || boardFullyLockedGlobally) ? styles.mysteryCardDisabled : ''}`}
                  onClick={() => handleFlipCard('GOLDEN', i)}
                >
                  {p.revealed ? p.name : <Sparkles size={28} />}
                </div>
              ))}
            </div>

            <div className={`${styles.catalogSectionHeader} ${styles.colorPlata}`}>NIVEL MEDIO DISPONIBLE ({inventory.SILVER})</div>
            <div className={styles.cardsCatalogGrid}>
              {catalog.SILVER.map((p, i) => (
                <div 
                  key={p.id} 
                  className={`${styles.mysteryCard} ${p.revealed ? styles.mysteryCardRevealed : ''} ${!p.revealed && (inventory.SILVER <= 0 || prizesWonCount.SILVER >= 1 || boardFullyLockedGlobally) ? styles.mysteryCardDisabled : ''}`}
                  onClick={() => handleFlipCard('SILVER', i)}
                >
                  {p.revealed ? p.name : <Hexagon size={28} />}
                </div>
              ))}
            </div>

            <div className={`${styles.catalogSectionHeader} ${styles.colorBronce}`}>NIVEL BÁSICO ({inventory.BRONZE}) - MAX {MAX_BRONZE_PRIZES}</div>
            <div className={styles.cardsCatalogGrid}>
              {catalog.BRONZE.map((p, i) => (
                <div 
                  key={p.id} 
                  className={`${styles.mysteryCard} ${p.revealed ? styles.mysteryCardRevealed : ''} ${!p.revealed && (inventory.BRONZE <= 0 || prizesWonCount.BRONZE >= MAX_BRONZE_PRIZES || boardFullyLockedGlobally) ? styles.mysteryCardDisabled : ''}`}
                  onClick={() => handleFlipCard('BRONZE', i)}
                >
                  {p.revealed ? p.name : <Circle size={28} />}
                </div>
              ))}
            </div>

            {totalInventory === 0 && selectedPrizes.length === 0 ? (
              <button className={styles.btn} onClick={() => setStage('dispute')}>
                💥 Discutir con la Banca
              </button>
            ) : (
              <>
                <button 
                  className={`${styles.btn} ${styles.btnGreen}`} 
                  disabled={!allowFinalTransition} 
                  onClick={() => setStage('final')}
                >
                  {boardFullyLockedGlobally && totalInventory > 0 ? "Tablero Bloqueado - Finalizar" : "Finalizar Partida"}
                </button>
                <button className={`${styles.btn} ${styles.btnOrange}`} onClick={triggerVoluntaryDispute}>
                  💥 No me gustan / Impugnar
                </button>
              </>
            )}
          </div>
        )}

        {/* STAGE 4: Emergency Dispute Screen */}
        {stage === 'dispute' && (
          <div key="dispute-wrapper">
            <h2 className={styles.h1}>⚖️ Tribunal de la Banca</h2>
            <p className={styles.subtitle}>¡Última oportunidad concedida!</p>
            <p className={styles.instructions}>Se anula tu inventario anterior. Destapa un regalo garantizado por sección:</p>

            <div className={styles.cardsCatalogGrid}>
              <button className={`${styles.mysteryCard} ${disputedReveals.GOLDEN ? styles.mysteryCardRevealed : ''}`} disabled={disputedReveals.GOLDEN} onClick={() => handleDisputeFlip('GOLDEN')}>
                {disputedReveals.GOLDEN ? "Revelada" : <Sparkles size={24} />}
              </button>
              <button className={`${styles.mysteryCard} ${disputedReveals.SILVER ? styles.mysteryCardRevealed : ''}`} disabled={disputedReveals.SILVER} onClick={() => handleDisputeFlip('SILVER')}>
                {disputedReveals.SILVER ? "Revelada" : <Hexagon size={24} />}
              </button>
            </div>
            <div className={styles.cardsCatalogGrid}>
              <button className={`${styles.mysteryCard} ${disputedReveals.BRONZE ? styles.mysteryCardRevealed : ''}`} disabled={disputedReveals.BRONZE} onClick={() => handleDisputeFlip('BRONZE')}>
                {disputedReveals.BRONZE ? "Revelada" : <Circle size={24} />}
              </button>
            </div>

            <button 
              className={`${styles.btn} ${styles.btnGreen}`} 
              disabled={!disputedReveals.GOLDEN || !disputedReveals.SILVER || !disputedReveals.BRONZE} 
              onClick={() => setStage('final')}
            >
              Reclamar Recompensas
            </button>
          </div>
        )}

        {/* STAGE 5: Final Screen Phase */}
        {stage === 'final' && (
          <div key="final-wrapper">
            <h2 className={styles.h1}>❤️ ¡JUEGO TERMINADO!</h2>
            <p className={styles.subtitle}>¡Enhorabuena por los premios conseguidos!</p>
            
            <div ref={certificateRef} className={styles.downloadCard}>
              <h3 className={styles.h1} style={{ fontSize: '1.2rem', marginBottom: 10 }}>Vales de Regalo Oficiales</h3>
              <ul className={styles.finalList}>
                {selectedPrizes.map((p, i) => (
                  <li key={i} className={styles.finalListItem}>
                    <Gift size={16} color="#43a047" /> {p}
                  </li>
                ))}
              </ul>
              <p className={styles.instructions}>
                Rasca y gana • 10º Aniversario y Cumpleaños Jesús Unlocked
              </p>
            </div>

            <button className={`${styles.btn} ${styles.btnBlue}`} onClick={handleDownloadImage}>
              <Download size={18} /> Descargar Ticket de Premios
            </button>
          </div>
        )}
      </main>

      {/* Persistent global inventory HUD layout */}
      <footer className={styles.inventory}>
        <div className={styles.invGrid}>
          <div className={styles.invItem}><span className={styles.invCount}>{inventory.BRONZE}</span><Circle size={14} color="#c59b76" /> Bronce</div>
          <div className={styles.invItem}><span className={styles.invCount}>{inventory.SILVER}</span><Hexagon size={14} color="#0070cd" /> Plata</div>
          <div className={styles.invItem}><span className={styles.invCount}>{inventory.GOLDEN}</span><Sparkles size={14} color="#fdb924" /> Suprema</div>
        </div>
      </footer>

      {/* SYSTEM 1: Main Feedback Modals Overlay */}
      {modal.show && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'center' }}>{modal.icon}</div>
            <h2 className={styles.h1} style={{ fontSize: '1.4rem' }}>{modal.title}</h2>
            <p className={styles.instructions}>{modal.text}</p>
            <button className={styles.btn} onClick={() => setModal({ ...modal, show: false })}>
              ¡Vamos!
            </button>
          </div>
        </div>
      )}

      {/* SYSTEM 2: Super Mario Rules Instructions Modal Overlay */}
      {showHelp && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalIconContainer}>
              <Coins size={44} color="#fdb924" />
            </div>
            <h2 className={`${styles.h1} styles.modalTitleSmall`}>Normas del Juego</h2>
            
            <div className={styles.rulesContainer}>
              <div className={styles.ruleRow}>
                <CheckCircle2 size={16} color="#43a047" className={styles.ruleIcon} />
                <span><b>Tríos Idénticos:</b> Golpea 3 bloques. Alinear 3 figuras iguales te otorga 1 moneda de su propia categoría (Bronce, Plata o Suprema).</span>
              </div>
              <div className={styles.ruleRow}>
                <Sparkles size={16} color="#fdb924" className={styles.ruleIcon} />
                <span><b>Combo Heterogéneo:</b> Si revelas 3 figuras válidas completamente distintas en un panel, consigues una <b>Moneda Suprema Golden</b> directa.</span>
              </div>
              <div className={styles.ruleRow}>
                <Circle size={16} color="#c59b76" className={styles.ruleIcon} />
                <span><b>Pareja de Consolación:</b> Si consigues <b>2 figuras válidas iguales</b> (y ninguna X), obtienes una <b>Moneda de Bronce</b> como recompensa. ¡La X anula la pareja!</span>
              </div>
              <div className={styles.ruleRow}>
                <ArrowUpRight size={16} color="#0070cd" className={styles.ruleIcon} />
                <span><b>Evolución en la Tienda:</b> Cambia 3 fichas de Bronce por 1 de Plata, o 3 de Plata por una Suprema Golden. No se permite devaluar hacia abajo.</span>
              </div>
              <div className={styles.ruleRow}>
                <ShieldAlert size={16} color="#e52521" className={styles.ruleIcon} />
                <span><b>Límites del Inventario:</b> Solo puedes canjear un máximo de 1 premio Golden y 1 de Plata. En cambio, puedes acumular varios de Bronce hasta un tope de <b>{MAX_BRONZE_PRIZES}</b>. Si te sobran monedas de rangos ya completados, el banco las convertirá automáticamente.</span>
              </div>
            </div>

            <button className={`${styles.btn} ${styles.btnGreen}`} onClick={() => setShowHelp(false)}>
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}