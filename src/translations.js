// src/translations.js — loaded first, no dependencies

const TRANSLATIONS = {
  en: {
    title: '🌲 SURVIVE THE WOODS 🌲', clickToStart: 'Click anywhere to start',
    controls: 'WASD: Move | Shift: Sprint | Mouse: Look | ESC: Pause',
    survive: 'Survive the night.', renderDist: 'RENDER DISTANCE',
    fast: '15 (fast)', pretty: '90 (pretty)',
    realShadows: 'REALISTIC SHADOWS', realShadowsSub: 'Sun shadows + HD flashlight · lower FPS',
    username: 'USERNAME', usernameSub: 'Shown above your head',
    shirtColor: 'SHIRT COLOR', shirtColorSub: 'Your body color',
    language: 'LANGUAGE', languageSub: 'Menu & UI text',
    bushes: 'BUSHES', bushesSub: 'Decoration only · keeps trees',
    lowDetail: 'LOW DETAIL MODE', lowDetailSub: 'Simple trees, no bushes, smaller hitbox · reloads page',
    loading: 'Loading world...', loadingMonster: 'Loading monster...',
    worldLoaded: 'World loaded', monsterFailed: 'Failed to load monster',
    day: 'DAY', night: 'NIGHT',
    hp: 'hp', survived: 'survived', state: 'state', dist: 'dist',
    watching: 'watching', sniffing: 'sniffing',
    health: 'HEALTH', stamina: 'STAMINA', rake: 'RAKE', shield: 'SHIELD',
    pressE: 'PRESS [E] TO OPEN SHOP', shop: 'SHOP', points: 'Points',
    gun: 'Pistol', gunDesc: 'Ranged weapon. 10 shots to bring down the rake.',
    spotlight: 'Pocket Spotlight', spotlightDesc: 'Wide passive light. Never fully blind — even without the flashlight.',
    close: 'CLOSE', shopHint: 'Click an item to buy, or press [E] to close',
    youDied: 'YOU DIED', survivedTime: 'Survived', reached: 'reached',
    diedBeforeNight: 'died before first night', pointsEarned: 'points earned (total:',
    clickRespawn: 'Click or press R to respawn',
    rakedRepelled: 'RAKE REPELLED', runForYourLife: 'RUN FOR YOUR LIFE',
    debugMode: '🐛 DEBUG MODE', clickCapture: 'Click anywhere to capture the mouse',
    fly: 'WASD = fly | Space / Shift = up / down', exitDebug: 'F = exit debug',
    debugAccess: '🔒 DEBUG ACCESS', enterPassword: 'Enter password to unlock',
    submit: 'SUBMIT', cancel: 'CANCEL', checking: 'Checking…',
    wrongPw: 'Wrong password', verified: 'Verified', enterPw: 'Enter a password',
    light: 'LIGHT', gunLabel: 'GUN', pts: 'pts', owned: 'OWNED',
  },
  pt: {
    title: '🌲 SOBREVIVA ÀS MATAS 🌲', clickToStart: 'Clique em qualquer lugar para começar',
    controls: 'WASD: Mover | Shift: Correr | Mouse: Olhar | ESC: Pausar',
    survive: 'Sobreviva à noite.', renderDist: 'DISTÂNCIA DE RENDERIZAÇÃO',
    fast: '15 (rápido)', pretty: '90 (bonito)',
    realShadows: 'SOMBRAS REALISTAS', realShadowsSub: 'Sombras do sol + lanterna HD · FPS menor',
    username: 'NOME DE USUÁRIO', usernameSub: 'Mostrado acima da sua cabeça',
    shirtColor: 'COR DA CAMISA', shirtColorSub: 'Cor do seu corpo',
    language: 'IDIOMA', languageSub: 'Menu e textos da interface',
    bushes: 'ARBUSTOS', bushesSub: 'Apenas decoração · mantém as árvores',
    lowDetail: 'MODO DE BAIXO DETALHE', lowDetailSub: 'Árvores simples, sem arbustos, hitbox menor · recarrega a página',
    loading: 'Carregando mundo...', loadingMonster: 'Carregando monstro...',
    worldLoaded: 'Mundo carregado', monsterFailed: 'Falha ao carregar o monstro',
    day: 'DIA', night: 'NOITE',
    hp: 'vida', survived: 'sobreviveu', state: 'estado', dist: 'dist',
    watching: 'observando', sniffing: 'cheirando',
    health: 'VIDA', stamina: 'ESTAMINA', rake: 'RAKE', shield: 'ESCUDO',
    pressE: 'PRESSIONE [E] PARA ABRIR A LOJA', shop: 'LOJA', points: 'Pontos',
    gun: 'Pistola', gunDesc: 'Arma à distância. 10 tiros para derrubar o rake.',
    spotlight: 'Lanterna de Bolso', spotlightDesc: 'Luz passiva ampla. Nunca totalmente cego — mesmo sem a lanterna.',
    close: 'FECHAR', shopHint: 'Clique em um item para comprar, ou pressione [E] para fechar',
    youDied: 'VOCÊ MORREU', survivedTime: 'Sobreviveu', reached: 'chegou a',
    diedBeforeNight: 'morreu antes da primeira noite', pointsEarned: 'pontos ganhos (total:',
    clickRespawn: 'Clique ou pressione R para renascer',
    rakedRepelled: 'RAKE REPELIDO', runForYourLife: 'CORRA PELA SUA VIDA',
    debugMode: '🐛 MODO DEBUG', clickCapture: 'Clique em qualquer lugar para capturar o mouse',
    fly: 'WASD = voar | Espaço / Shift = subir / descer', exitDebug: 'F = sair do debug',
    debugAccess: '🔒 ACESSO DEBUG', enterPassword: 'Digite a senha para desbloquear',
    submit: 'ENVIAR', cancel: 'CANCELAR', checking: 'Verificando…',
    wrongPw: 'Senha incorreta', verified: 'Verificado', enterPw: 'Digite uma senha',
    light: 'LUZ', gunLabel: 'ARMA', pts: 'pts', owned: 'ADQUIRIDO',
  }
};

let currentLang = 'en';
try { currentLang = localStorage.getItem('lang') || 'en'; } catch (e) {}
if (!TRANSLATIONS[currentLang]) currentLang = 'en';

function t(key) {
  const pack = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return (key in pack) ? pack[key] : (TRANSLATIONS.en[key] || key);
}

// Walk the DOM, replace every [data-i18n] with the current language string.
// Also updates the password-modal strings that don't use data-i18n.
// Does NOT touch shop UI — ui.js handles that when the language changes.
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (/<[a-z][\s\S]*>/i.test(val)) el.innerHTML = val;
    else el.textContent = val;
  });
  const mt = document.getElementById('dpModalTitle');
  if (mt) mt.textContent = t('debugAccess');
  const ms = document.getElementById('dpModalSub');
  if (ms) ms.textContent = t('enterPassword');
  const sub = document.getElementById('debugPasswordSubmit');
  if (sub) sub.textContent = t('submit');
  const can = document.getElementById('debugPasswordCancel');
  if (can) can.textContent = t('cancel');
}
